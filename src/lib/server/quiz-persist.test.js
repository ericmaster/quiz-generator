// @vitest-environment node
import { expect, test, describe, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from './db.js';
import { quiz, question } from './schema.js';
import { eq, and } from 'drizzle-orm';

/**
 * Wraps a node:sqlite DatabaseSync instance to mock a Cloudflare D1Database.
 */
function createD1Mock(nodeDb) {
  return {
    prepare(queryText) {
      let stmt;
      try {
        stmt = nodeDb.prepare(queryText);
      } catch (err) {
        console.error('Failed to prepare statement:', queryText, err);
        throw err;
      }
      
      let boundArgs = [];
      const prep = {
        bind(...args) {
          boundArgs = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
          boundArgs = boundArgs.map(val => val instanceof Date ? val.getTime() : val);
          return prep;
        },
        async all() {
          const results = stmt.all(...boundArgs);
          return { results };
        },
        async run() {
          const info = stmt.run(...boundArgs);
          return {
            success: true,
            meta: {
              changes: info.changes,
              last_row_id: info.lastInsertRowid
            }
          };
        },
        async first() {
          return stmt.get(...boundArgs) || null;
        },
        async raw() {
          const results = stmt.all(...boundArgs);
          return results.map(row => Object.values(row));
        }
      };
      return prep;
    },
    async batch(statements) {
      const results = [];
      for (const stmt of statements) {
        results.push(await stmt.all());
      }
      return results;
    },
    async exec(sql) {
      nodeDb.exec(sql);
      return { count: 0, duration: 0 };
    }
  };
}

describe('Quiz Persistence, Curation & Export Logic', () => {
  let nodeDb;
  let d1Mock;
  let env;
  let db;

  beforeEach(() => {
    nodeDb = new DatabaseSync(':memory:');

    // Apply migrations
    const migration0 = fs.readFileSync(path.resolve('./migrations/0000_dashing_starbolt.sql'), 'utf-8');
    const statements0 = migration0.split('--> statement-breakpoint');
    for (const stmt of statements0) {
      if (stmt.trim()) {
        nodeDb.exec(stmt.trim());
      }
    }

    const migration1 = fs.readFileSync(path.resolve('./migrations/0001_fts.sql'), 'utf-8');
    nodeDb.exec(migration1);

    d1Mock = createD1Mock(nodeDb);
    env = { DB: d1Mock };
    db = getDb(env);

    // Seed test users
    nodeDb.exec(`
      INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
      VALUES 
        ('user-A', 'User A', 'usera@example.com', 1, 1600000000000, 1600000000000),
        ('user-B', 'User B', 'userb@example.com', 1, 1600000000000, 1600000000000)
    `);
  });

  afterEach(() => {
    nodeDb.close();
  });

  test('saveQuiz: insert quiz + 3 questions', async () => {
    const quizId = 'quiz-123';
    const createdAt = new Date();
    
    await db.insert(quiz).values({
      id: quizId,
      userId: 'user-A',
      title: 'Science Quiz',
      difficulty: 'medium',
      createdAt
    });

    const questionsToInsert = [
      { id: 'q-1', quizId, questionText: 'Q1', options: JSON.stringify(['A', 'B', 'C', 'D']), answer: 'A', explanation: 'Exp 1', position: 0 },
      { id: 'q-2', quizId, questionText: 'Q2', options: JSON.stringify(['E', 'F', 'G', 'H']), answer: 'F', explanation: 'Exp 2', position: 1 },
      { id: 'q-3', quizId, questionText: 'Q3', options: JSON.stringify(['I', 'J', 'K', 'L']), answer: 'K', explanation: 'Exp 3', position: 2 }
    ];

    for (const q of questionsToInsert) {
      await db.insert(question).values(q);
    }

    const quizRows = await db.select().from(quiz).where(eq(quiz.id, quizId));
    expect(quizRows).toHaveLength(1);
    expect(quizRows[0].title).toBe('Science Quiz');
    expect(quizRows[0].difficulty).toBe('medium');
    expect(quizRows[0].userId).toBe('user-A');

    const questionRows = await db.select().from(question).where(eq(question.quizId, quizId)).orderBy(question.position);
    expect(questionRows).toHaveLength(3);
    
    expect(questionRows[0].id).toBe('q-1');
    expect(questionRows[0].position).toBe(0);
    expect(JSON.parse(questionRows[0].options)).toEqual(['A', 'B', 'C', 'D']);

    expect(questionRows[1].id).toBe('q-2');
    expect(questionRows[1].position).toBe(1);

    expect(questionRows[2].id).toBe('q-3');
    expect(questionRows[2].position).toBe(2);
  });

  test('listQuizzes - user isolation', async () => {
    await db.insert(quiz).values({
      id: 'quiz-A',
      userId: 'user-A',
      title: 'User A Quiz',
      difficulty: 'easy',
      createdAt: new Date()
    });

    await db.insert(quiz).values({
      id: 'quiz-B',
      userId: 'user-B',
      title: 'User B Quiz',
      difficulty: 'hard',
      createdAt: new Date()
    });

    const listA = await db.select().from(quiz).where(eq(quiz.userId, 'user-A'));
    expect(listA).toHaveLength(1);
    expect(listA[0].id).toBe('quiz-A');

    const listB = await db.select().from(quiz).where(eq(quiz.userId, 'user-B'));
    expect(listB).toHaveLength(1);
    expect(listB[0].id).toBe('quiz-B');
  });

  test('getQuizById - ownership check', async () => {
    await db.insert(quiz).values({
      id: 'quiz-B',
      userId: 'user-B',
      title: 'User B Quiz',
      difficulty: 'hard',
      createdAt: new Date()
    });

    const fetchAsA = await db
      .select()
      .from(quiz)
      .where(and(eq(quiz.id, 'quiz-B'), eq(quiz.userId, 'user-A')));
    expect(fetchAsA).toHaveLength(0);

    const fetchAsB = await db
      .select()
      .from(quiz)
      .where(and(eq(quiz.id, 'quiz-B'), eq(quiz.userId, 'user-B')));
    expect(fetchAsB).toHaveLength(1);
    expect(fetchAsB[0].id).toBe('quiz-B');
  });

  test('patchQuestion: update questionText and options', async () => {
    const quizId = 'quiz-123';
    await db.insert(quiz).values({
      id: quizId,
      userId: 'user-A',
      title: 'Science Quiz',
      difficulty: 'medium',
      createdAt: new Date()
    });

    await db.insert(question).values({
      id: 'q-1',
      quizId,
      questionText: 'Original Text',
      options: JSON.stringify(['A', 'B', 'C', 'D']),
      answer: 'A',
      explanation: 'Exp',
      position: 0
    });

    const newOptions = ['X', 'Y', 'Z', 'W'];
    await db
      .update(question)
      .set({
        questionText: 'Updated Text',
        options: JSON.stringify(newOptions),
        answer: 'Y'
      })
      .where(eq(question.id, 'q-1'));

    const updated = (await db.select().from(question).where(eq(question.id, 'q-1')))[0];
    expect(updated.questionText).toBe('Updated Text');
    expect(updated.options).toBe(JSON.stringify(newOptions));
    expect(updated.answer).toBe('Y');
  });

  test('deleteQuestion - position renumber', async () => {
    const quizId = 'quiz-123';
    await db.insert(quiz).values({
      id: quizId,
      userId: 'user-A',
      title: 'Science Quiz',
      difficulty: 'medium',
      createdAt: new Date()
    });

    await db.insert(question).values({ id: 'q-1', quizId, questionText: 'Q1', options: '[]', answer: 'A', explanation: '', position: 0 });
    await db.insert(question).values({ id: 'q-2', quizId, questionText: 'Q2', options: '[]', answer: 'B', explanation: '', position: 1 });
    await db.insert(question).values({ id: 'q-3', quizId, questionText: 'Q3', options: '[]', answer: 'C', explanation: '', position: 2 });

    await db.delete(question).where(eq(question.id, 'q-2'));

    const remaining = await db
      .select()
      .from(question)
      .where(eq(question.quizId, quizId))
      .orderBy(question.position);
      
    for (let i = 0; i < remaining.length; i++) {
      await db
        .update(question)
        .set({ position: i })
        .where(eq(question.id, remaining[i].id));
    }

    const finalQuestions = await db
      .select()
      .from(question)
      .where(eq(question.quizId, quizId))
      .orderBy(question.position);

    expect(finalQuestions).toHaveLength(2);
    expect(finalQuestions[0].id).toBe('q-1');
    expect(finalQuestions[0].position).toBe(0);
    expect(finalQuestions[1].id).toBe('q-3');
    expect(finalQuestions[1].position).toBe(1);
  });

  test('reorder questions', async () => {
    const quizId = 'quiz-123';
    await db.insert(quiz).values({
      id: quizId,
      userId: 'user-A',
      title: 'Science Quiz',
      difficulty: 'medium',
      createdAt: new Date()
    });

    await db.insert(question).values({ id: 'q-0', quizId, questionText: 'Q1', options: '[]', answer: 'A', explanation: '', position: 0 });
    await db.insert(question).values({ id: 'q-1', quizId, questionText: 'Q2', options: '[]', answer: 'B', explanation: '', position: 1 });
    await db.insert(question).values({ id: 'q-2', quizId, questionText: 'Q3', options: '[]', answer: 'C', explanation: '', position: 2 });

    const order = ['q-2', 'q-0', 'q-1'];
    for (let i = 0; i < order.length; i++) {
      await db
        .update(question)
        .set({ position: i })
        .where(and(eq(question.id, order[i]), eq(question.quizId, quizId)));
    }

    const final = await db
      .select()
      .from(question)
      .where(eq(question.quizId, quizId))
      .orderBy(question.position);

    expect(final[0].id).toBe('q-2');
    expect(final[0].position).toBe(0);
    
    expect(final[1].id).toBe('q-0');
    expect(final[1].position).toBe(1);
    
    expect(final[2].id).toBe('q-1');
    expect(final[2].position).toBe(2);
  });

  test('deleteQuiz - cascade to questions', async () => {
    const quizId = 'quiz-123';
    await db.insert(quiz).values({
      id: quizId,
      userId: 'user-A',
      title: 'Science Quiz',
      difficulty: 'medium',
      createdAt: new Date()
    });

    await db.insert(question).values({ id: 'q-1', quizId, questionText: 'Q1', options: '[]', answer: 'A', explanation: '', position: 0 });
    await db.insert(question).values({ id: 'q-2', quizId, questionText: 'Q2', options: '[]', answer: 'B', explanation: '', position: 1 });

    await db.delete(quiz).where(eq(quiz.id, quizId));

    const questionRows = await db.select().from(question).where(eq(question.quizId, quizId));
    expect(questionRows).toHaveLength(0);
  });
});
