import { deleteDocument } from '$lib/server/documents.js';

/** @type {import('./$types').RequestHandler} */
export async function DELETE(event) {
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
  if (!platform || !platform.env) {
    return new Response(
      JSON.stringify({ error: 'Platform bindings are not available' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3. Call deleteDocument
  try {
    const result = await deleteDocument(platform.env, userId, documentId);
    
    if (!result.success) {
      if (result.reason === 'not_found') {
        return new Response(
          JSON.stringify({ error: 'Document not found or access denied' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: result.reason || 'Failed to delete document' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ deleted: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[API Document Delete] Error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
