// @vitest-environment node
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from './db.js';
import { document, chunk } from './schema.js';
import { hybridSearch, sanitizeFtsQuery } from './search.js';

/**
 * Wraps a node:sqlite DatabaseSync instance to mock a Cloudflare D1Database.
 * Identical to the mock used in ingest.test.js
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

describe('FTS5 Query Sanitization', () => {
  test('replaces operators and punctuation with spaces and quotes terms', () => {
    expect(sanitizeFtsQuery('deep-learning')).toBe('"deep" "learning"');
    expect(sanitizeFtsQuery('neural: networks')).toBe('"neural" "networks"');
    expect(sanitizeFtsQuery('"quoted string"')).toBe('"quoted" "string"');
    expect(sanitizeFtsQuery('AI* OR NOT AND')).toBe('"AI" "OR" "NOT" "AND"');
    expect(sanitizeFtsQuery('hello (world)^')).toBe('"hello" "world"');
  });

  test('handles empty or pure punctuation inputs safely', () => {
    expect(sanitizeFtsQuery('')).toBe('');
    expect(sanitizeFtsQuery('   ')).toBe('');
    expect(sanitizeFtsQuery(':*"-^')).toBe('');
  });

  test('supports non-English letters (Unicode)', () => {
    expect(sanitizeFtsQuery('élégant garçon 123')).toBe('"élégant" "garçon" "123"');
  });
});

describe('Hybrid Search Engine', () => {
  let nodeDb;
  let d1Mock;
  let env;

  beforeEach(() => {
    // 1. Initialize SQLite in memory
    nodeDb = new DatabaseSync(':memory:');

    // 2. Apply migrations
    const migration0 = fs.readFileSync(path.resolve('./migrations/0000_dashing_starbolt.sql'), 'utf-8');
    const statements0 = migration0.split('--> statement-breakpoint');
    for (const stmt of statements0) {
      if (stmt.trim()) {
        nodeDb.exec(stmt.trim());
      }
    }

    const migration1 = fs.readFileSync(path.resolve('./migrations/0001_fts.sql'), 'utf-8');
    nodeDb.exec(migration1);

    // 3. Create D1 Mock
    d1Mock = createD1Mock(nodeDb);

    env = {
      DB: d1Mock
    };

    // 4. Seed database with test users, documents and chunks
    nodeDb.exec(`
      INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
      VALUES ('user-alpha', 'User Alpha', 'alpha@example.com', 1, 1600000000000, 1600000000000);

      INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
      VALUES ('user-beta', 'User Beta', 'beta@example.com', 1, 1600000000000, 1600000000000);

      INSERT INTO document (id, user_id, filename, mime_type, size_bytes, status, created_at)
      VALUES ('doc-a1', 'user-alpha', 'doc_a1.txt', 'text/plain', 100, 'ready', 1600000000000);

      INSERT INTO document (id, user_id, filename, mime_type, size_bytes, status, created_at)
      VALUES ('doc-a2', 'user-alpha', 'doc_a2.txt', 'text/plain', 100, 'ready', 1600000000000);

      INSERT INTO document (id, user_id, filename, mime_type, size_bytes, status, created_at)
      VALUES ('doc-b1', 'user-beta', 'doc_b1.txt', 'text/plain', 100, 'ready', 1600000000000);

      -- User Alpha Doc A1 Chunks
      INSERT INTO chunk (id, document_id, content, chunk_index)
      VALUES ('chunk-a1-1', 'doc-a1', 'Supervised learning trains models using labeled training data.', 0);

      INSERT INTO chunk (id, document_id, content, chunk_index)
      VALUES ('chunk-a1-2', 'doc-a1', 'Unsupervised learning finds hidden patterns in unlabeled data.', 1);

      -- User Alpha Doc A2 Chunks
      INSERT INTO chunk (id, document_id, content, chunk_index)
      VALUES ('chunk-a2-1', 'doc-a2', 'Deep neural networks excel at complex computer vision tasks.', 0);

      -- User Beta Doc B1 Chunks
      INSERT INTO chunk (id, document_id, content, chunk_index)
      VALUES ('chunk-b1-1', 'doc-b1', 'Supervised models are also used for simple classification.', 0);
    `);
  });

  afterEach(() => {
    nodeDb.close();
  });

  test('FTS5 keyword search returns correct scoped chunk ids and handles punctuation without throwing', async () => {
    // We can query our database using the search sanitization directly to verify the raw keyword query path
    const safeQuery = sanitizeFtsQuery('supervised "learning" :');
    expect(safeQuery).toBe('"supervised" "learning"');
    
    // Scoped to User Alpha
    const query = `
      SELECT c.id, c.content
      FROM chunk c
      JOIN document d ON c.document_id = d.id
      JOIN chunk_fts fts ON c.id = fts.chunk_id
      WHERE fts.chunk_fts MATCH ?
        AND d.user_id = 'user-alpha'
      ORDER BY bm25(chunk_fts) ASC
    `;
    
    const stmt = env.DB.prepare(query).bind(safeQuery);
    const { results } = await stmt.all();

    // Should match chunk-a1-1 ('Supervised learning...') but NOT chunk-b1-1 because it belongs to user-beta
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('chunk-a1-1');

    // Also assert that empty/punctuation-only query doesn't throw and works
    const emptyQuery = sanitizeFtsQuery('::: ***');
    expect(emptyQuery).toBe('');
  });

  test('hybridSearch fuses Vectorize and D1 FTS5 results via RRF and returns hydrated records', async () => {
    // 1. Mock AI
    const fakeAi = {
      run: vi.fn().mockResolvedValue({
        shape: [1, 1024],
        data: [[0.1, 0.2]]
      })
    };

    // 2. Mock Vectorize
    // We want Vectorize to return a match that ranks 'chunk-a1-2' first (score 0.9) and 'chunk-a1-1' second (score 0.8)
    const fakeVectorize = {
      query: vi.fn().mockResolvedValue({
        count: 2,
        matches: [
          { id: 'chunk-a1-2', score: 0.9 },
          { id: 'chunk-a1-1', score: 0.8 }
        ]
      })
    };

    env.AI = fakeAi;
    env.VECTORIZE = fakeVectorize;

    // We query for "supervised learning" which exists in D1 FTS5 as chunk-a1-1.
    // So:
    // Semantic ranked list: ['chunk-a1-2', 'chunk-a1-1']
    // Keyword ranked list: ['chunk-a1-1'] (since it matches "Supervised learning")
    //
    // RRF Score calculation:
    // chunk-a1-1:
    //   - Semantic rank 2 (index 1) -> 1/(60+2) ≈ 0.016129
    //   - Keyword rank 1 (index 0) -> 1/(60+1) ≈ 0.016393
    //   - Total: 0.032522
    // chunk-a1-2:
    //   - Semantic rank 1 (index 0) -> 1/(60+1) ≈ 0.016393
    //   - Keyword rank (none) -> 0
    //   - Total: 0.016393
    //
    // Therefore, chunk-a1-1 should rank first, then chunk-a1-2.

    const results = await hybridSearch(env, {
      userId: 'user-alpha',
      query: 'supervised learning',
      topK: 5
    });

    expect(results).toHaveLength(2);
    
    // Top result should be chunk-a1-1 (present in both)
    expect(results[0].chunkId).toBe('chunk-a1-1');
    expect(results[0].documentId).toBe('doc-a1');
    expect(results[0].content).toContain('Supervised learning');
    expect(results[0].score).toBeCloseTo(1/62 + 1/61, 6);

    // Second result should be chunk-a1-2 (present only in semantic)
    expect(results[1].chunkId).toBe('chunk-a1-2');
    expect(results[1].score).toBeCloseTo(1/61, 6);

    // Assert that Vectorize.query filter was correctly constructed
    expect(fakeVectorize.query).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        filter: { user_id: 'user-alpha' }
      })
    );
  });

  test('hybridSearch respects documentIds filter and scopes correctly', async () => {
    const fakeAi = {
      run: vi.fn().mockResolvedValue({
        shape: [1, 1024],
        data: [[0.1]]
      })
    };

    const fakeVectorize = {
      query: vi.fn().mockResolvedValue({
        count: 2,
        matches: [
          { id: 'chunk-a2-1', score: 0.95 },
          { id: 'chunk-a1-1', score: 0.85 }
        ]
      })
    };

    env.AI = fakeAi;
    env.VECTORIZE = fakeVectorize;

    // Filter search only to doc-a2
    const results = await hybridSearch(env, {
      userId: 'user-alpha',
      query: 'deep neural computer vision',
      documentIds: ['doc-a2'],
      topK: 5
    });

    // Even though Vectorize mocks returned 'chunk-a1-1' as a candidate,
    // the FTS keyword query and final hydration are constrained to doc-a2,
    // and Vectorize filter passed is doc-a2.
    expect(fakeVectorize.query).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        filter: {
          user_id: 'user-alpha',
          document_id: { $in: ['doc-a2'] }
        }
      })
    );

    // Only chunk-a2-1 should be returned because chunk-a1-1 belongs to doc-a1 which is not in documentIds
    expect(results).toHaveLength(1);
    expect(results[0].chunkId).toBe('chunk-a2-1');
  });

  test('hybridSearch degrades gracefully to keyword-only search if bindings are missing', async () => {
    // env lacks AI and VECTORIZE bindings
    const results = await hybridSearch(env, {
      userId: 'user-alpha',
      query: 'supervised',
      topK: 5
    });

    // Should return only the keyword hits from D1
    expect(results).toHaveLength(1);
    expect(results[0].chunkId).toBe('chunk-a1-1');
  });

  test('hybridSearch returns empty array if documentIds is empty', async () => {
    const results = await hybridSearch(env, {
      userId: 'user-alpha',
      query: 'supervised',
      documentIds: [],
      topK: 5
    });

    expect(results).toEqual([]);
  });
});
