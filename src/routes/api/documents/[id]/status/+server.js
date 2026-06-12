import { getDb } from '$lib/server/db.js';
import { document } from '$lib/server/schema.js';
import { eq, and } from 'drizzle-orm';

/**
 * @type {import('./$types').RequestHandler}
 */
export async function GET(event) {
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

  // 3. Fetch document and check ownership
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

    return new Response(
      JSON.stringify({ id: doc.id, status: doc.status }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error fetching document status:', err);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
