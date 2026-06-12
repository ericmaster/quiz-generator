import { getDb } from './db.js';
import { document, chunk, topic, documentTopic } from './schema.js';
import { eq, and } from 'drizzle-orm';
import { chunkText } from './chunk.js';
import { chatJSON, parseTopicsResponse } from './ai/openrouter.js';

/**
 * Sample up to `maxChars` from `text` as head + middle + tail slices, so topic
 * extraction reflects the whole Document rather than only its opening section.
 * @param {string} text
 * @param {number} maxChars
 * @returns {string}
 */
function sampleForExtraction(text, maxChars) {
  if (text.length <= maxChars) return text;
  const slice = Math.floor(maxChars / 3);
  const head = text.slice(0, slice);
  const midStart = Math.max(slice, Math.floor(text.length / 2 - slice / 2));
  const middle = text.slice(midStart, midStart + slice);
  const tail = text.slice(text.length - slice);
  return `${head}\n[...]\n${middle}\n[...]\n${tail}`;
}

/**
 * Background task to process an uploaded document.
 * Handles chunking, topic extraction, and updates the document status.
 *
 * @param {Record<string, any>} env - Cloudflare platform env object
 * @param {string} documentId - The ID of the document to process
 * @returns {Promise<void>}
 */
export async function processDocument(env, documentId) {
  const db = getDb(env);

  try {
    // 1. Fetch document row
    const docs = await db.select().from(document).where(eq(document.id, documentId)).limit(1);
    const doc = docs[0];
    if (!doc) {
      console.error(`[Ingest] Document not found: ${documentId}`);
      return;
    }

    // 2. Set status = 'processing'
    await db.update(document)
      .set({ status: 'processing' })
      .where(eq(document.id, documentId));

    console.log(`[Ingest] Processing document ${documentId} (${doc.filename})`);

    // 3. Read raw text from R2
    const r2Key = doc.r2Key;
    const r2Object = await env.DOCS_BUCKET.get(r2Key);
    if (!r2Object) {
      throw new Error(`R2 object not found for key: ${r2Key}`);
    }
    const text = await r2Object.text();

    // 4. Idempotency: delete existing chunks and topic links for this document
    await db.delete(chunk).where(eq(chunk.documentId, documentId));
    await db.delete(documentTopic).where(eq(documentTopic.documentId, documentId));

    // 5. Chunk the text and insert chunk rows
    const chunks = chunkText(text);
    if (chunks.length > 0) {
      const chunkRows = chunks.map(c => ({
        id: crypto.randomUUID(),
        documentId,
        content: c.content,
        chunkIndex: c.chunkIndex
      }));

      // Batch inserts in sizes of 100 to avoid D1 payload limitations
      const BATCH_SIZE = 100;
      for (let i = 0; i < chunkRows.length; i += BATCH_SIZE) {
        const batch = chunkRows.slice(i, i + BATCH_SIZE);
        await db.insert(chunk).values(batch);
      }
    }

    // 6. Extract topics using OpenRouter
    const maxCharsForExtraction = 9000;
    const textSlice = sampleForExtraction(text, maxCharsForExtraction);

    const systemPrompt = `You are an expert educational AI. Your task is to analyze the provided text and extract between 3 to 8 high-level topics or subject names.
Each topic must be a short, concise concept name (e.g., "Neural Networks", "Backpropagation", "SvelteKit", "Cloudflare Workers").
Do not include generic topics like "Introduction", "Summary", or the document filename.

Output rules (follow exactly):
- Return ONLY a raw JSON array of plain strings — nothing else.
- Each array element MUST be a string, NOT an object (do NOT return [{"topic": "..."}]).
- Do NOT wrap the array in markdown code fences and do NOT add any prose before or after it.
Example of the exact required format:
["Neural Networks", "Backpropagation", "Gradient Descent"]`;

    const userPrompt = `Extract high-level topics from the following text:\n\n--- START OF TEXT ---\n${textSlice}\n--- END OF TEXT ---`;

    let topicNames = [];
    try {
      const schema = {
        type: 'array',
        items: { type: 'string' }
      };

      const aiResponse = await chatJSON(env, {
        system: systemPrompt,
        user: userPrompt,
        schema
      });

      topicNames = parseTopicsResponse(aiResponse);
    } catch (aiErr) {
      throw new Error(`OpenRouter topic extraction failed: ${aiErr.message}`);
    }

    // 7. Upsert topics and link them to the document
    for (const name of topicNames) {
      // Upsert topic (merged by userId + name)
      await db.insert(topic)
        .values({
          id: crypto.randomUUID(),
          userId: doc.userId,
          name: name
        })
        .onConflictDoNothing();

      // Retrieve the topic ID (newly inserted or existing)
      const existingTopics = await db.select()
        .from(topic)
        .where(
          and(
            eq(topic.userId, doc.userId),
            eq(topic.name, name)
          )
        )
        .limit(1);

      if (existingTopics.length > 0) {
        const topicId = existingTopics[0].id;
        
        // Link document and topic (ignore on conflict)
        await db.insert(documentTopic)
          .values({
            documentId,
            topicId
          })
          .onConflictDoNothing();
      }
    }

    // 8. Set status = 'ready'
    await db.update(document)
      .set({ status: 'ready' })
      .where(eq(document.id, documentId));

    console.log(`[Ingest] Successfully processed document ${documentId}`);
  } catch (err) {
    console.error(`[Ingest] Failed to process document ${documentId}:`, err);
    
    // Set status = 'failed' on error
    try {
      await db.update(document)
        .set({ status: 'failed' })
        .where(eq(document.id, documentId));
    } catch (dbErr) {
      console.error(`[Ingest] Failed to update document status to 'failed':`, dbErr);
    }
  }
}
