import { getDb } from "$lib/server/db.js";
import { topic, documentTopic, document } from "$lib/server/schema.js";
import { eq, and } from "drizzle-orm";

/** @type {import('./$types').PageServerLoad} */
export async function load(event) {
  const platform = event.platform;
  if (!platform || !platform.env || !platform.env.DB) {
    return { topics: [] };
  }

  const db = getDb(platform.env);
  const userId = event.locals.user.id;

  try {
    // Select topics owned by this user that have at least one document linked with status='ready'
    const topicsWithReadyDocs = await db.selectDistinct({
      id: topic.id,
      name: topic.name
    })
    .from(topic)
    .innerJoin(documentTopic, eq(topic.id, documentTopic.topicId))
    .innerJoin(document, eq(documentTopic.documentId, document.id))
    .where(
      and(
        eq(topic.userId, userId),
        eq(document.status, "ready")
      )
    );

    return {
      topics: topicsWithReadyDocs
    };
  } catch (err) {
    console.error("Failed to load topics:", err);
    return { topics: [] };
  }
}
