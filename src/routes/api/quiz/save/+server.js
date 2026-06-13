import { createAuth } from '$lib/server/auth.js';
import { getDb } from '$lib/server/db.js';
import { quiz, question } from '$lib/server/schema.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, platform }) {
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

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { title, difficulty, questions } = body;

  if (typeof title !== 'string' || !title.trim()) {
    return new Response(
      JSON.stringify({ error: 'Title is required and must be non-empty' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!difficulty || !['easy', 'medium', 'hard'].includes(difficulty)) {
    return new Response(
      JSON.stringify({ error: 'Difficulty must be easy, medium, or hard' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!questions || !Array.isArray(questions) || questions.length < 1 || questions.length > 20) {
    return new Response(
      JSON.stringify({ error: 'Questions must be an array of 1 to 20 items' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q || typeof q !== 'object') {
      return new Response(JSON.stringify({ error: `Question at index ${i} is invalid` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (typeof q.question !== 'string' || !q.question.trim()) {
      return new Response(JSON.stringify({ error: `Question at index ${i} missing question text` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some(o => typeof o !== 'string' || !o.trim())) {
      return new Response(JSON.stringify({ error: `Question at index ${i} must have exactly 4 non-empty string options` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const trimmedOptions = q.options.map(o => o.trim());
    if (new Set(trimmedOptions).size !== 4) {
      return new Response(JSON.stringify({ error: `Question at index ${i} options must be distinct` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (typeof q.answer !== 'string' || !trimmedOptions.includes(q.answer.trim())) {
      return new Response(JSON.stringify({ error: `Question at index ${i} answer must match one of the options` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
  }

  const db = getDb(env);
  const quizId = crypto.randomUUID();
  const createdAt = new Date();

  try {
    await db.insert(quiz).values({
      id: quizId,
      userId,
      title: title.trim(),
      difficulty,
      createdAt
    });

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const trimmedOptions = q.options.map(o => o.trim());
      const trimmedAnswer = q.answer.trim();
      await db.insert(question).values({
        id: crypto.randomUUID(),
        quizId,
        questionText: q.question.trim(),
        options: JSON.stringify(trimmedOptions),
        answer: trimmedAnswer,
        explanation: typeof q.explanation === 'string' ? q.explanation.trim() : '',
        position: i
      });
    }

    return new Response(
      JSON.stringify({ id: quizId, title: title.trim(), questionCount: questions.length }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Failed to save quiz:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to save quiz' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
