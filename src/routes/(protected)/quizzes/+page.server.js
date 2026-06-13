import { getDb } from '$lib/server/db.js';
import { quiz, question } from '$lib/server/schema.js';
import { eq, desc } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export async function load({ locals, platform }) {
  if (!locals.user) throw error(401);
  const env = platform.env;
  const db = getDb(env);
  const quizzes = await db.select().from(quiz).where(eq(quiz.userId, locals.user.id)).orderBy(desc(quiz.createdAt));
  // get question counts
  const withCounts = await Promise.all(quizzes.map(async q => {
    const qs = await db.select({ id: question.id }).from(question).where(eq(question.quizId, q.id));
    return { ...q, questionCount: qs.length };
  }));
  return { quizzes: withCounts };
}
