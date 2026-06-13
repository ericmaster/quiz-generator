import { createAuth } from '$lib/server/auth.js';
import { getDb } from '$lib/server/db.js';
import { quiz, question } from '$lib/server/schema.js';
import { eq, and } from 'drizzle-orm';

async function checkOwnership(db, quizId, userId) {
  const result = await db.select().from(quiz).where(eq(quiz.id, quizId)).limit(1);
  if (result.length === 0 || result[0].userId !== userId) {
    return null;
  }
  return result[0];
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ params, request, platform }) {
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

  const db = getDb(env);
  const quizRow = await checkOwnership(db, params.id, session.user.id);
  if (!quizRow) {
    return new Response(
      JSON.stringify({ error: 'Quiz not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { order } = body;

  try {
    const existingQuestions = await db
      .select({ id: question.id })
      .from(question)
      .where(eq(question.quizId, params.id));

    const existingSet = new Set(existingQuestions.map(q => q.id));

    if (!order || !Array.isArray(order) || order.length !== existingSet.size) {
      return new Response(
        JSON.stringify({ error: 'Order must contain exactly the same set of question IDs as the quiz' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const orderSet = new Set(order);
    if (orderSet.size !== order.length) {
      return new Response(
        JSON.stringify({ error: 'Duplicate IDs in order array' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    for (const id of order) {
      if (!existingSet.has(id)) {
        return new Response(
          JSON.stringify({ error: `Question ID ${id} does not belong to this quiz` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    for (let i = 0; i < order.length; i++) {
      await db
        .update(question)
        .set({ position: i })
        .where(and(eq(question.id, order[i]), eq(question.quizId, params.id)));
    }

    return new Response(
      JSON.stringify({ updated: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Failed to reorder questions:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to reorder questions' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
