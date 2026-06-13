import { getDb } from "./db.js";
import { document, chunk, documentTopic, topic } from "./schema.js";
import { and, eq } from "drizzle-orm";

/**
 * Clean up a document across all stores: database rows, Vectorize vectors, and R2 object.
 *
 * @param {Record<string, any>} env - Cloudflare platform env object
 * @param {string} userId - Owner user ID
 * @param {string} documentId - ID of document to delete
 * @returns {Promise<{ success: boolean, reason?: string }>} Delete status
 */
export async function deleteDocument(env, userId, documentId) {
  const db = getDb(env);

  // 1. Fetch document and check ownership
  const docs = await db.select()
    .from(document)
    .where(and(eq(document.id, documentId), eq(document.userId, userId)))
    .limit(1);

  const doc = docs[0];
  if (!doc) {
    return { success: false, reason: "not_found" };
  }

  // 2. Collect chunk ids
  const chunkRows = await db.select({ id: chunk.id })
    .from(chunk)
    .where(eq(chunk.documentId, documentId));
  const chunkIds = chunkRows.map(c => c.id);

  // 3. Collect linked topic ids
  const docTopicRows = await db.select({ topicId: documentTopic.topicId })
    .from(documentTopic)
    .where(eq(documentTopic.documentId, documentId));
  const linkedTopicIds = docTopicRows.map(dt => dt.topicId);

  // 4. Vectorize: delete chunks (best-effort)
  if (env.VECTORIZE && chunkIds.length > 0) {
    try {
      await env.VECTORIZE.deleteByIds(chunkIds);
    } catch (err) {
      console.error(`[Delete Document] Failed to delete from Vectorize:`, err);
    }
  }

  // 5. R2: delete document (best-effort)
  if (env.DOCS_BUCKET && doc.r2Key) {
    try {
      await env.DOCS_BUCKET.delete(doc.r2Key);
    } catch (err) {
      console.error(`[Delete Document] Failed to delete from R2:`, err);
    }
  }

  // 6. D1: Delete document_topic links explicitly first
  if (linkedTopicIds.length > 0) {
    await db.delete(documentTopic).where(eq(documentTopic.documentId, documentId));
  }

  // 7. Delete chunks explicitly (in case FK cascades aren't enabled in current environment)
  if (chunkIds.length > 0) {
    await db.delete(chunk).where(eq(chunk.documentId, documentId));
  }

  // 8. Delete document itself
  await db.delete(document).where(eq(document.id, documentId));

  // 9. Clean up orphaned topics — a Topic disappears when its last linked
  //    Document is deleted. Scope the delete to the owner defensively so it can
  //    never touch another user's topic even if the schema changes later.
  //    Note: this whole cleanup is NOT atomic (D1 has no multi-statement
  //    transaction here); a mid-sequence failure can leave the external stores
  //    (Vectorize/R2) or topics partially cleaned. Acceptable at this scale.
  for (const topicId of linkedTopicIds) {
    const remainingLinks = await db.select()
      .from(documentTopic)
      .where(eq(documentTopic.topicId, topicId));

    if (remainingLinks.length === 0) {
      await db.delete(topic).where(and(eq(topic.id, topicId), eq(topic.userId, userId)));
    }
  }

  return { success: true };
}
