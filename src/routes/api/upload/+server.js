import { getDb } from '$lib/server/db.js';
import { document } from '$lib/server/schema.js';
import { MAX_DOCUMENT_BYTES } from '$lib/parse.js';

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

  // 2. Read and parse body
  let body;
  try {
    body = await event.request.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }), 
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { filename, mimeType, sizeBytes, text } = body;

  // 3. Validation
  if (typeof text !== 'string' || text.trim() === '') {
    return new Response(
      JSON.stringify({ error: 'Text content is required and must be non-empty' }), 
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // `sizeBytes` is the client-reported ORIGINAL file size — advisory metadata
  // only (used for display). It is sanity-checked but is NOT the security
  // boundary, since a client controls it. The authoritative cap is on the
  // actual received `text` payload below.
  if (typeof sizeBytes !== 'number' || sizeBytes > MAX_DOCUMENT_BYTES || sizeBytes <= 0) {
    return new Response(
      JSON.stringify({ error: 'File size exceeds the 5MB maximum limit' }),
      { status: 413, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Authoritative server-side cap: the actual bytes we are about to store in R2.
  const textBytes = new TextEncoder().encode(text).length;
  if (textBytes > MAX_DOCUMENT_BYTES) {
    return new Response(
      JSON.stringify({ error: 'Extracted text size exceeds the 5MB limit' }), 
      { status: 413, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Filename validation
  if (typeof filename !== 'string' || filename.trim() === '' || filename.length > 255) {
    return new Response(
      JSON.stringify({ error: 'Invalid or missing filename' }), 
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // MIME type validation
  const allowedMimeTypes = ['application/pdf', 'text/plain', 'text/markdown'];
  if (typeof mimeType !== 'string' || !allowedMimeTypes.includes(mimeType)) {
    return new Response(
      JSON.stringify({ error: 'Unsupported MIME type. Supported types are PDF, text/plain, and text/markdown.' }), 
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 4. Platform bindings check
  const platform = event.platform;
  if (!platform || !platform.env || !platform.env.DOCS_BUCKET || !platform.env.DB) {
    return new Response(
      JSON.stringify({ error: 'Platform storage bindings are not available' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const db = getDb(platform.env);
  const documentId = crypto.randomUUID();
  const r2Key = `documents/${userId}/${documentId}.txt`;

  // 5. R2 Put
  try {
    await platform.env.DOCS_BUCKET.put(r2Key, text, {
      httpMetadata: { contentType: 'text/plain' }
    });
  } catch (err) {
    console.error('R2 upload failed:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to upload document text to storage' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 6. D1 DB Insert
  try {
    await db.insert(document).values({
      id: documentId,
      userId,
      filename,
      mimeType,
      sizeBytes,
      r2Key,
      status: 'pending',
      createdAt: new Date(),
    });
  } catch (dbErr) {
    console.error('D1 insert failed, cleaning up R2 object:', dbErr);
    // Best-effort cleanup of the orphaned R2 object
    try {
      await platform.env.DOCS_BUCKET.delete(r2Key);
    } catch (cleanupErr) {
      console.error('Failed to delete R2 object during cleanup:', cleanupErr);
    }

    return new Response(
      JSON.stringify({ error: 'Failed to record document metadata' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 7. Success Response
  return new Response(
    JSON.stringify({ id: documentId, filename, status: 'pending' }),
    { status: 201, headers: { 'Content-Type': 'application/json' } }
  );
}
