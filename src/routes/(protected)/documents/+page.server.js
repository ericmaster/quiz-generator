import { getDb } from "$lib/server/db.js";
import { document } from "$lib/server/schema.js";
import { eq, desc } from "drizzle-orm";

/** @type {import('./$types').PageServerLoad} */
export async function load(event) {
  const platform = event.platform;
  if (!platform || !platform.env || !platform.env.DB) {
    return { documents: [] };
  }

  const db = getDb(platform.env);
  const userId = event.locals.user.id;

  try {
    const docs = await db.select()
      .from(document)
      .where(eq(document.userId, userId))
      .orderBy(desc(document.createdAt));

    return {
      documents: docs.map(d => ({
        id: d.id,
        filename: d.filename,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        status: d.status,
        createdAt: d.createdAt instanceof Date ? d.createdAt.getTime() : Number(d.createdAt)
      }))
    };
  } catch (err) {
    console.error("Failed to load documents:", err);
    return { documents: [] };
  }
}
