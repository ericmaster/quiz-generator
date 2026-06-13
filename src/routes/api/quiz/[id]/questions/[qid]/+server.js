import { createAuth } from '$lib/server/auth.js';
import { getDb } from '$lib/server/db.js';
import { quiz, question } from '$lib/server/schema.js';
import { eq, and } from 'drizzle-orm';

async function getQuestionAndCheckOwnership(db, quizId, questionId, userId) {
  const result = await db
    .select({
      question: question,
      userId: quiz.userId
    })
    .from(question)
    .innerJoin(quiz, eq(question.quizId, quiz.id))
    .where(and(eq(question.id, questionId), eq(quiz.id, quizId)))
    .limit(1);

  if (result.length === 0 || result[0].userId !== userId) {
    return null;
  }
  return result[0].question;
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
  const existingQuestion = await getQuestionAndCheckOwnership(db, params.id, params.qid, session.user.id);
  if (!existingQuestion) {
    return new Response(
      JSON.stringify({ error: 'Question not found' }),
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

  const { questionText, options, answer, explanation } = body;
  const updateData = {};

  if (questionText !== undefined) {
    if (typeof questionText !== 'string' || !questionText.trim()) {
      return new Response(
        JSON.stringify({ error: 'questionText cannot be empty' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    updateData.questionText = questionText.trim();
  }

  let finalOptions = null;
  if (options !== undefined) {
    if (!Array.isArray(options) || options.length !== 4) {
      return new Response(
        JSON.stringify({ error: 'options must be an array of exactly 4 strings' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    for (const opt of options) {
      if (typeof opt !== 'string' || !opt.trim()) {
        return new Response(
          JSON.stringify({ error: 'options cannot contain empty strings' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    const uniqueOpts = new Set(options.map(o => o.trim()));
    if (uniqueOpts.size !== 4) {
      return new Response(
        JSON.stringify({ error: 'options must contain 4 distinct values' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    finalOptions = Array.from(uniqueOpts);
    updateData.options = JSON.stringify(finalOptions);
  }

  if (answer !== undefined) {
    if (typeof answer !== 'string' || !answer.trim()) {
      return new Response(
        JSON.stringify({ error: 'answer cannot be empty' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const checkAnswer = answer.trim();
    if (finalOptions) {
      if (!finalOptions.includes(checkAnswer)) {
        return new Response(
          JSON.stringify({ error: 'answer must be one of the provided options' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else {
      let existingOptions = [];
      try {
        existingOptions = JSON.parse(existingQuestion.options);
      } catch (e) {
        existingOptions = [];
      }
      if (!existingOptions.includes(checkAnswer)) {
        return new Response(
          JSON.stringify({ error: 'answer must be one of the existing options' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    updateData.answer = checkAnswer;
  } else if (finalOptions !== null) {
    if (!finalOptions.includes(existingQuestion.answer)) {
      return new Response(
        JSON.stringify({ error: 'existing answer must be one of the new options or a new answer must be provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  if (explanation !== undefined) {
    if (typeof explanation !== 'string') {
      return new Response(
        JSON.stringify({ error: 'explanation must be a string' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    updateData.explanation = explanation.trim();
  }

  try {
    if (Object.keys(updateData).length > 0) {
      await db.update(question).set(updateData).where(eq(question.id, params.qid));
    }

    const updatedQuestion = {
      id: existingQuestion.id,
      questionText: updateData.questionText !== undefined ? updateData.questionText : existingQuestion.questionText,
      options: finalOptions !== null ? finalOptions : JSON.parse(existingQuestion.options),
      answer: updateData.answer !== undefined ? updateData.answer : existingQuestion.answer,
      explanation: updateData.explanation !== undefined ? updateData.explanation : existingQuestion.explanation,
      position: existingQuestion.position
    };

    return new Response(
      JSON.stringify(updatedQuestion),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Failed to patch question:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to update question' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
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
  const existingQuestion = await getQuestionAndCheckOwnership(db, params.id, params.qid, session.user.id);
  if (!existingQuestion) {
    return new Response(
      JSON.stringify({ error: 'Question not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    await db.delete(question).where(eq(question.id, params.qid));

    const remainingQuestions = await db
      .select()
      .from(question)
      .where(eq(question.quizId, params.id))
      .orderBy(question.position);

    for (let i = 0; i < remainingQuestions.length; i++) {
      await db
        .update(question)
        .set({ position: i })
        .where(eq(question.id, remainingQuestions[i].id));
    }

    return new Response(
      JSON.stringify({ deleted: true, remainingCount: remainingQuestions.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Failed to delete question:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to delete question' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
