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
        position: q.position,
        question: q.questionText,
        options: parsedOptions,
        answer: q.answer,
        explanation: q.explanation
      };
    });

    const exportData = {
      title: quizRow.title,
      difficulty: quizRow.difficulty,
      exportedAt: new Date().toISOString(),
      questions: formattedQuestions
    };

    return new Response(
      JSON.stringify(exportData, null, 2),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="quiz-${params.id}.json"`
        }
      }
    );
  } catch (err) {
    console.error('Failed to export quiz:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to export quiz' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
