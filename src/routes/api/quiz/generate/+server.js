import { generateQuiz } from '$lib/server/quiz.js';

/** @type {import('./$types').RequestHandler} */
export async function POST(event) {
  // 1. Auth check
  if (!event.locals.user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Platform bindings check
  const platform = event.platform;
  if (!platform || !platform.env) {
    return new Response(
      JSON.stringify({ error: 'Platform bindings are not available' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3. Parse request body
  let body;
  try {
    body = await event.request.json();
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { topicIds, difficulty, count } = body;

  // 4. Validate input types
  if (!topicIds || !Array.isArray(topicIds) || topicIds.length === 0) {
    return new Response(
      JSON.stringify({ error: 'topicIds must be a non-empty array of strings' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!difficulty || !['easy', 'medium', 'hard'].includes(difficulty)) {
    return new Response(
      JSON.stringify({ error: 'difficulty must be easy, medium, or hard' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const parsedCount = Number(count);
  if (isNaN(parsedCount) || parsedCount < 1 || parsedCount > 20) {
    return new Response(
      JSON.stringify({ error: 'count must be a number between 1 and 20' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 5. Generate quiz
  try {
    const result = await generateQuiz(platform.env, {
      userId: event.locals.user.id,
      topicIds,
      difficulty,
      count: parsedCount
    });

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[API Quiz Generate] Generation error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to generate quiz' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
