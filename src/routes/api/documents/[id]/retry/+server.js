import { getDb } from '$lib/server/db.js';
import { document } from '$lib/server/schema.js';
import { eq, and } from 'drizzle-orm';
import { processDocument } from '$lib/server/ingest.js';

/**
 * @type {import('./$types').RequestHandler}
 */
export async function POST(event) {
  // 1. Auth check
  if (!event.locals.user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }), 
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const userId = event.locals.user.id;
  const documentId = event.params.id;

  // 2. Platform bindings check
  const platform = event.platform;
  if (!platform || !platform.env || !platform.env.DB) {
    return new Response(
      JSON.stringify({ error: 'Database binding is not available' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const db = getDb(platform.env);

  // 3. Fetch document and check ownership and status
  try {
    const docs = await db.select()
      .from(document)
      .where(and(eq(document.id, documentId), eq(document.userId, userId)))
      .limit(1);

    const doc = docs[0];
    if (!doc) {
      return new Response(
        JSON.stringify({ error: 'Document not found or access denied' }), 
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Only allow retry for failed documents
    if (doc.status !== 'failed') {
      return new Response(
        JSON.stringify({ error: `Only documents with 'failed' status can be retried. Current status: '${doc.status}'` }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update status to 'processing' before starting the background process
    await db.update(document)
      .set({ status: 'processing' })
      .where(eq(document.id, documentId));

    // 4. Schedule processing in background
    const processPromise = processDocument(platform.env, documentId);
    if (platform.context && typeof platform.context.waitUntil === 'function') {
      platform.context.waitUntil(processPromise);
    } else {
      processPromise.catch(err => {
        console.error('Background retry failed in fallback context:', err);
      });
    }

    return new Response(
      JSON.stringify({ id: doc.id, status: 'processing' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error retrying document processing:', err);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
