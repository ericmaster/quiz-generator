import { getDb } from '$lib/server/db.js';
import { quiz, question } from '$lib/server/schema.js';
import { eq, and } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';

export async function load({ locals, platform, params }) {
  if (!locals.user) throw redirect(303, '/login');
  const env = platform.env;
  const db = getDb(env);
  const quizzes = await db
    .select()
    .from(quiz)
    .where(and(eq(quiz.id, params.id), eq(quiz.userId, locals.user.id)))
    .limit(1);
    
  if (!quizzes[0]) throw error(404);
  
  const questionsList = await db
    .select()
    .from(question)
    .where(eq(question.quizId, params.id))
    .orderBy(question.position);
    
  return {
    quiz: quizzes[0],
    questions: questionsList.map(q => {
      let parsedOptions = [];
      try {
        parsedOptions = JSON.parse(q.options);
      } catch (e) {
        parsedOptions = [];
      }
      return { ...q, options: parsedOptions };
    })
  };
}
