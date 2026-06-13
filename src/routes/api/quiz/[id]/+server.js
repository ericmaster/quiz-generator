import { createAuth } from '$lib/server/auth.js';
import { getDb } from '$lib/server/db.js';
import { quiz, question } from '$lib/server/schema.js';
import { eq } from 'drizzle-orm';

async function checkOwnership(db, quizId, userId) {
  const result = await db.select().from(quiz).where(eq(quiz.id, quizId)).limit(1);
  if (result.length === 0 || result[0].userId !== userId) {
    return null;
  }
  return result[0];
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, request, platform }) {
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

  try {
    const questionsList = await db
      .select()
      .from(question)
      .where(eq(question.quizId, params.id))
      .orderBy(question.position);

    const formattedQuestions = questionsList.map(q => {
      let parsedOptions = [];
      try {
        parsedOptions = JSON.parse(q.options);
      } catch (e) {
        parsedOptions = [];
      }
      return {
        id: q.id,
        questionText: q.questionText,
        options: parsedOptions,
        answer: q.answer,
        explanation: q.explanation,
        position: q.position
      };
    });

    return new Response(
      JSON.stringify({
        id: quizRow.id,
        title: quizRow.title,
        difficulty: quizRow.difficulty,
        createdAt: quizRow.createdAt,
        questions: formattedQuestions
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Failed to get quiz:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to get quiz' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/** @type {import('./$types').RequestHandler} */
export async function PATCH({ params, request, platform }) {
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

  const { title } = body;
  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) {
      return new Response(
        JSON.stringify({ error: 'Title cannot be empty' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    try {
      await db.update(quiz).set({ title: title.trim() }).where(eq(quiz.id, params.id));
      return new Response(
        JSON.stringify({ id: params.id, title: title.trim() }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      console.error('Failed to update quiz title:', err);
      return new Response(
        JSON.stringify({ error: 'Failed to update quiz title' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response(
    JSON.stringify({ id: quizRow.id, title: quizRow.title }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ params, request, platform }) {
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

  try {
    await db.delete(quiz).where(eq(quiz.id, params.id));
    return new Response(
      JSON.stringify({ deleted: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Failed to delete quiz:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to delete quiz' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
