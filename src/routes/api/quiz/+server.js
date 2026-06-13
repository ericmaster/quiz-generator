import { createAuth } from '$lib/server/auth.js';
import { getDb } from '$lib/server/db.js';
import { quiz, question } from '$lib/server/schema.js';
import { eq, desc, sql } from 'drizzle-orm';

/** @type {import('./$types').RequestHandler} */
export async function GET({ request, platform }) {
  const env = platform?.env;
  if (!env) {
    return new Response(
      JSON.stringify({ error: 'Platform env missing' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const auth = createAuth(env, new URL(request.url).origin);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const userId = session.user.id;

  const db = getDb(env);

  try {
    const list = await db
      .select({
        id: quiz.id,
        title: quiz.title,
        difficulty: quiz.difficulty,
        createdAt: quiz.createdAt,
        questionCount: sql`count(${question.id})`.mapWith(Number)
      })
      .from(quiz)
      .leftJoin(question, eq(quiz.id, question.quizId))
      .where(eq(quiz.userId, userId))
      .groupBy(quiz.id)
      .orderBy(desc(quiz.createdAt));

    return new Response(
      JSON.stringify({ quizzes: list }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Failed to list quizzes:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to list quizzes' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
