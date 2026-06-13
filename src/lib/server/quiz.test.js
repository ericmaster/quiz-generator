// @vitest-environment node
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from './db.js';
import { validateQuestions, buildGenerationPrompt, generateQuiz } from './quiz.js';

// Setup mocks for hybridSearch and chatJSON
const mockHybridSearch = vi.fn();
const mockChatJSON = vi.fn();

vi.mock('./search.js', () => {
  return {
    hybridSearch: (...args) => mockHybridSearch(...args)
  };
});

vi.mock('./ai/openrouter.js', () => {
  return {
    chatJSON: (...args) => mockChatJSON(...args),
    FREE_MODELS: []
  };
});

describe('validateQuestions unit tests', () => {
  test('accepts a valid set and drops invalid fields/items', () => {
    const validRaw = [
      {
        question: 'What is Svelte?',
        options: ['Framework', 'Library', 'Language', 'Database'],
        answer: 'Framework',
        explanation: 'Svelte is a component framework.'
      },
      {
        question: 'What is D1?',
        options: ['NoSQL', 'SQL Database', 'Cache', 'Key-Value'],
        answer: 'SQL Database',
        explanation: 'D1 is Cloudflare\'s SQL database.'
      }
    ];

    const result = validateQuestions(validRaw, { count: 2 });
    expect(result).toHaveLength(2);
    expect(result[0].question).toBe('What is Svelte?');
    expect(result[0].options).toEqual(['Framework', 'Library', 'Language', 'Database']);
    expect(result[0].answer).toBe('Framework');
    expect(result[0].explanation).toBe('Svelte is a component framework.');
  });

  test('extracts questions array if wrapped in object', () => {
    const validRaw = {
      questions: [
        {
          question: 'What is Svelte?',
          options: ['Framework', 'Library', 'Language', 'Database'],
          answer: 'Framework',
          explanation: 'Svelte is a component framework.'
        }
      ]
    };

    const result = validateQuestions(validRaw, { count: 1 });
    expect(result).toHaveLength(1);
    expect(result[0].question).toBe('What is Svelte?');
  });

  test('rejects answer not in options', () => {
    const raw = [
      {
        question: 'What is Svelte?',
        options: ['Framework', 'Library', 'Language', 'Database'],
        answer: 'Not in options',
        explanation: 'Svelte is a component framework.'
      }
    ];
    const result = validateQuestions(raw, { count: 1 });
    expect(result).toHaveLength(0);
  });

  test('rejects incorrect option count', () => {
    const raw = [
      {
        question: 'What is Svelte?',
        options: ['Framework', 'Library'],
        answer: 'Framework',
        explanation: 'Svelte is a component framework.'
      }
    ];
    const result = validateQuestions(raw, { count: 1 });
    expect(result).toHaveLength(0);
  });

  test('rejects duplicate options', () => {
    const raw = [
      {
        question: 'What is Svelte?',
        options: ['Framework', 'Framework', 'Language', 'Database'],
        answer: 'Framework',
        explanation: 'Svelte is a component framework.'
      }
    ];
    const result = validateQuestions(raw, { count: 1 });
    expect(result).toHaveLength(0);
  });

  test('rejects empty or non-string fields', () => {
    const raw = [
      {
        question: '',
        options: ['Framework', 'Library', 'Language', 'Database'],
        answer: 'Framework',
        explanation: 'Svelte is a component framework.'
      },
      {
        question: 'Ok?',
        options: [1, 'Library', 'Language', 'Database'],
        answer: 'Library',
        explanation: 'Svelte is a component framework.'
      }
    ];
    const result = validateQuestions(raw, { count: 2 });
    expect(result).toHaveLength(0);
  });

  test('defaults empty explanation', () => {
    const raw = [
      {
        question: 'What is Svelte?',
        options: ['Framework', 'Library', 'Language', 'Database'],
        answer: 'Framework',
        explanation: ''
      }
    ];
    const result = validateQuestions(raw, { count: 1 });
    expect(result).toHaveLength(1);
    expect(result[0].explanation).toBe('No explanation provided.');
  });

  test('deduplicates by question text (case-insensitive)', () => {
    const raw = [
      {
        question: 'What is Svelte?',
        options: ['Framework', 'Library', 'Language', 'Database'],
        answer: 'Framework',
        explanation: 'Exp'
      },
      {
        question: 'what is svelte?',
        options: ['Framework', 'Library', 'Language', 'Database'],
        answer: 'Framework',
        explanation: 'Exp'
      }
    ];
    const result = validateQuestions(raw, { count: 2 });
    expect(result).toHaveLength(1);
  });

  test('caps results to count', () => {
    const raw = [
      {
        question: 'Q1',
        options: ['A', 'B', 'C', 'D'],
        answer: 'A',
        explanation: 'E'
      },
      {
        question: 'Q2',
        options: ['A', 'B', 'C', 'D'],
        answer: 'A',
        explanation: 'E'
      }
    ];
    const result = validateQuestions(raw, { count: 1 });
    expect(result).toHaveLength(1);
  });
});

describe('generateQuiz integration tests', () => {
  let nodeDb;
  let d1Mock;
  let env;

  function createD1Mock(db) {
    return {
      prepare(queryText) {
        let stmt;
        try {
          stmt = db.prepare(queryText);
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
              meta: { changes: info.changes, last_row_id: info.lastInsertRowid }
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
        db.exec(sql);
        return { count: 0, duration: 0 };
      }
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    nodeDb = new DatabaseSync(':memory:');
    const migration0 = fs.readFileSync(path.resolve('./migrations/0000_dashing_starbolt.sql'), 'utf-8');
    const statements0 = migration0.split('--> statement-breakpoint');
    for (const stmt of statements0) {
      if (stmt.trim()) {
        nodeDb.exec(stmt.trim());
      }
    }

    d1Mock = createD1Mock(nodeDb);
    env = {
      DB: d1Mock
    };

    // Seed database
    nodeDb.exec(`
      INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
      VALUES ('user-alpha', 'Alpha User', 'alpha@example.com', 1, 1600000000000, 1600000000000);

      INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
      VALUES ('user-other', 'Other User', 'other@example.com', 1, 1600000000000, 1600000000000);

      INSERT INTO topic (id, user_id, name)
      VALUES ('topic-svelte', 'user-alpha', 'SvelteKit');

      INSERT INTO topic (id, user_id, name)
      VALUES ('topic-d1', 'user-alpha', 'D1 Database');

      INSERT INTO topic (id, user_id, name)
      VALUES ('topic-foreign', 'user-other', 'Foreign Topic');

      INSERT INTO document (id, user_id, filename, mime_type, size_bytes, status, r2_key, created_at)
      VALUES ('doc-1', 'user-alpha', 'svelte_doc.txt', 'text/plain', 500, 'ready', 'doc-1-key', 1600000000000);

      INSERT INTO document (id, user_id, filename, mime_type, size_bytes, status, r2_key, created_at)
      VALUES ('doc-2', 'user-alpha', 'd1_doc.txt', 'text/plain', 500, 'ready', 'doc-2-key', 1600000000000);

      INSERT INTO document (id, user_id, filename, mime_type, size_bytes, status, r2_key, created_at)
      VALUES ('doc-pending', 'user-alpha', 'pending.txt', 'text/plain', 500, 'pending', 'pending-key', 1600000000000);

      -- Links
      INSERT INTO document_topic (document_id, topic_id) VALUES ('doc-1', 'topic-svelte');
      INSERT INTO document_topic (document_id, topic_id) VALUES ('doc-2', 'topic-d1');
      INSERT INTO document_topic (document_id, topic_id) VALUES ('doc-pending', 'topic-d1');

      -- Chunks
      INSERT INTO chunk (id, document_id, content, chunk_index)
      VALUES ('chunk-svelte-1', 'doc-1', 'Svelte compiler turns components into highly efficient JavaScript.', 0);

      INSERT INTO chunk (id, document_id, content, chunk_index)
      VALUES ('chunk-d1-1', 'doc-2', 'D1 is a serverless SQL database from Cloudflare.', 0);
    `);
  });

  afterEach(() => {
    nodeDb.close();
  });

  test('fails on invalid difficulty', async () => {
    await expect(
      generateQuiz(env, { userId: 'user-alpha', topicIds: ['topic-svelte'], difficulty: 'very-hard', count: 5 })
    ).rejects.toThrow('Invalid difficulty');
  });

  test('fails on empty topicIds', async () => {
    await expect(
      generateQuiz(env, { userId: 'user-alpha', topicIds: [], difficulty: 'medium', count: 5 })
    ).rejects.toThrow('topicIds must be a non-empty array');
  });

  test('returns structured empty response when no owned topics are found', async () => {
    const result = await generateQuiz(env, {
      userId: 'user-alpha',
      topicIds: ['topic-foreign'],
      difficulty: 'medium',
      count: 5
    });

    expect(result.questions).toHaveLength(0);
    expect(result.generatedCount).toBe(0);
    expect(result.reason).toContain('No owned topics found');
  });

  test('returns structured empty response when no ready docs are found for owned topics', async () => {
    // We add a new topic that has no documents
    nodeDb.exec(`
      INSERT INTO topic (id, user_id, name)
      VALUES ('topic-empty', 'user-alpha', 'Empty Topic');
    `);

    const result = await generateQuiz(env, {
      userId: 'user-alpha',
      topicIds: ['topic-empty'],
      difficulty: 'medium',
      count: 5
    });

    expect(result.questions).toHaveLength(0);
    expect(result.generatedCount).toBe(0);
    expect(result.reason).toContain('No content chunks found');
  });

  test('calls hybridSearch, aggregates, calls chatJSON, and returns validated quiz', async () => {
    // 1. Mock hybridSearch
    mockHybridSearch.mockImplementation((_env, { query, documentIds }) => {
      if (query === 'SvelteKit') {
        expect(documentIds).toEqual(['doc-1']);
        return [
          { chunkId: 'chunk-svelte-1', documentId: 'doc-1', content: 'Svelte compiler content', score: 1.0 }
        ];
      }
      if (query === 'D1 Database') {
        // Only doc-2 should be ready, doc-pending should be excluded
        expect(documentIds).toEqual(['doc-2']);
        return [
          { chunkId: 'chunk-d1-1', documentId: 'doc-2', content: 'D1 database content', score: 1.0 }
        ];
      }
      return [];
    });

    // 2. Mock chatJSON returning a set of questions (including one invalid to prove validation drops it)
    mockChatJSON.mockResolvedValue([
      {
        question: 'What is Svelte?',
        options: ['Framework', 'Library', 'Language', 'Database'],
        answer: 'Framework',
        explanation: 'Explanation Svelte'
      },
      {
        question: 'Invalid Question',
        options: ['A', 'B'], // invalid options count
        answer: 'A',
        explanation: ''
      },
      {
        question: 'What is D1?',
        options: ['SQL', 'NoSQL', 'Cache', 'Queue'],
        answer: 'SQL',
        explanation: 'Explanation D1'
      }
    ]);

    const result = await generateQuiz(env, {
      userId: 'user-alpha',
      topicIds: ['topic-svelte', 'topic-d1', 'topic-foreign'], // topic-foreign is ignored
      difficulty: 'medium',
      count: 5
    });

    // Assert hybridSearch was called for the owned topics
    expect(mockHybridSearch).toHaveBeenCalledTimes(2);

    // Assert chatJSON was called with prompt containing context chunks
    expect(mockChatJSON).toHaveBeenCalled();
    const chatCallArgs = mockChatJSON.mock.calls[0][1];
    expect(chatCallArgs.system).toContain('expert educator');
    expect(chatCallArgs.system).toContain('medium');
    expect(chatCallArgs.system).toContain('SvelteKit');
    expect(chatCallArgs.system).toContain('D1 Database');
    expect(chatCallArgs.user).toContain('Svelte compiler content');
    expect(chatCallArgs.user).toContain('D1 database content');

    // Assert result returns correct count, source document IDs, and drops invalid questions
    expect(result.questions).toHaveLength(2); // Only 2 valid ones
    expect(result.questions[0].question).toBe('What is Svelte?');
    expect(result.questions[1].question).toBe('What is D1?');
    expect(result.topicNames.sort()).toEqual(['D1 Database', 'SvelteKit']);
    expect(result.sourceDocumentIds).toContain('doc-1');
    expect(result.sourceDocumentIds).toContain('doc-2');
    expect(result.generatedCount).toBe(2);
  });
});
