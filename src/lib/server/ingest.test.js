// @vitest-environment node
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from './db.js';
import { document, chunk, topic, documentTopic } from './schema.js';
import { processDocument } from './ingest.js';
import { eq } from 'drizzle-orm';

/**
 * Wraps a node:sqlite DatabaseSync instance to mock a Cloudflare D1Database.
 * Converts async promise-based Drizzle calls to sync node:sqlite executions.
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
          // Normalize Date objects to timestamp integers, as SQLite adapter in node:sqlite doesn't auto-convert them
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

describe('Document ingestion pipeline', () => {
  let nodeDb;
  let d1Mock;
  let mockBucket;
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

    // 4. Create R2 Mock
    mockBucket = {
      store: new Map(),
      async put(key, text) {
        this.store.set(key, text);
      },
      async get(key) {
        if (!this.store.has(key)) return null;
        const textContent = this.store.get(key);
        return {
          async text() {
            return textContent;
          }
        };
      },
      async delete(key) {
        this.store.delete(key);
      }
    };

    // 5. Create env
    env = {
      DB: d1Mock,
      DOCS_BUCKET: mockBucket,
      OPENROUTER_API_KEY: 'test-key'
    };

    // 6. Mock fetch for OpenRouter
    vi.stubGlobal('fetch', vi.fn());

    // 7. Seed initial user
    nodeDb.exec(`
      INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
      VALUES ('user-456', 'Alice Ingest', 'alice@example.com', 1, 1600000000000, 1600000000000)
    `);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    nodeDb.close();
  });

  test('successfully processes document: pending -> processing -> ready', async () => {
    const db = getDb(env);

    // 1. Insert document in D1
    const docId = 'doc-test-123';
    const r2Key = 'documents/user-456/doc-test-123.txt';
    const docText = 'Artificial Intelligence and Machine Learning. Deep Learning builds on top of Neural Networks.';
    
    await db.insert(document).values({
      id: docId,
      userId: 'user-456',
      filename: 'ai_intro.txt',
      mimeType: 'text/plain',
      sizeBytes: docText.length,
      r2Key,
      status: 'pending',
      createdAt: new Date()
    });

    // 2. Put text in mock R2
    await mockBucket.put(r2Key, docText);

    // 3. Stub OpenRouter response
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '["Artificial Intelligence", "Machine Learning"]' } }]
      })
    });

    // 4. Run ingestion
    await processDocument(env, docId);

    // 5. Assert document status updated to 'ready'
    const docs = await db.select().from(document).where(eq(document.id, docId));
    expect(docs[0].status).toBe('ready');

    // 6. Assert chunks inserted
    const chunks = await db.select().from(chunk).where(eq(chunk.documentId, docId));
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content).toContain('Artificial Intelligence');

    // 7. Assert topics created and mapped
    const topics = await db.select().from(topic).where(eq(topic.userId, 'user-456'));
    expect(topics).toHaveLength(2);
    expect(topics.map(t => t.name)).toContain('Artificial Intelligence');
    expect(topics.map(t => t.name)).toContain('Machine Learning');

    const links = await db.select().from(documentTopic).where(eq(documentTopic.documentId, docId));
    expect(links).toHaveLength(2);
  });

  test('merges topics by name case-insensitively across multiple documents', async () => {
    const db = getDb(env);

    // Document 1
    const docId1 = 'doc-1';
    const r2Key1 = 'documents/user-456/doc-1.txt';
    const docText1 = 'Neural Networks are models of the human brain.';
    await db.insert(document).values({
      id: docId1,
      userId: 'user-456',
      filename: 'doc1.txt',
      mimeType: 'text/plain',
      sizeBytes: docText1.length,
      r2Key: r2Key1,
      status: 'pending',
      createdAt: new Date()
    });
    await mockBucket.put(r2Key1, docText1);

    // Document 2
    const docId2 = 'doc-2';
    const r2Key2 = 'documents/user-456/doc-2.txt';
    const docText2 = 'Backpropagation trains neural networks.';
    await db.insert(document).values({
      id: docId2,
      userId: 'user-456',
      filename: 'doc2.txt',
      mimeType: 'text/plain',
      sizeBytes: docText2.length,
      r2Key: r2Key2,
      status: 'pending',
      createdAt: new Date()
    });
    await mockBucket.put(r2Key2, docText2);

    // Run first ingestion
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '["Neural Networks"]' } }]
      })
    });
    await processDocument(env, docId1);

    // Run second ingestion (returns same topic, in different case)
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '["neural networks", "Backpropagation"]' } }]
      })
    });
    await processDocument(env, docId2);

    // Assert only 2 topics exist in the DB (merged by name)
    const allTopics = await db.select().from(topic).where(eq(topic.userId, 'user-456'));
    expect(allTopics).toHaveLength(2); // 'Neural Networks' and 'Backpropagation'
    
    // Check links
    const links1 = await db.select().from(documentTopic).where(eq(documentTopic.documentId, docId1));
    expect(links1).toHaveLength(1);

    const links2 = await db.select().from(documentTopic).where(eq(documentTopic.documentId, docId2));
    expect(links2).toHaveLength(2); // Linked to both
  });

  test('gracefully fails and sets status to failed on OpenRouter error', async () => {
    const db = getDb(env);
    const docId = 'doc-fail';
    const r2Key = 'documents/user-456/doc-fail.txt';
    await db.insert(document).values({
      id: docId,
      userId: 'user-456',
      filename: 'fail.txt',
      mimeType: 'text/plain',
      sizeBytes: 10,
      r2Key,
      status: 'pending',
      createdAt: new Date()
    });
    await mockBucket.put(r2Key, 'Some content.');

    // OpenRouter returns error
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Error'
    });

    await processDocument(env, docId);

    const docs = await db.select().from(document).where(eq(document.id, docId));
    expect(docs[0].status).toBe('failed');
  });

  test('idempotency: retrying clear and recreates chunks and topic links', async () => {
    const db = getDb(env);
    const docId = 'doc-retry';
    const r2Key = 'documents/user-456/doc-retry.txt';
    await db.insert(document).values({
      id: docId,
      userId: 'user-456',
      filename: 'retry.txt',
      mimeType: 'text/plain',
      sizeBytes: 10,
      r2Key,
      status: 'pending',
      createdAt: new Date()
    });
    await mockBucket.put(r2Key, 'Content of the document.');

    // First run
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '["TopicA"]' } }]
      })
    });
    await processDocument(env, docId);

    const chunksBefore = await db.select().from(chunk).where(eq(chunk.documentId, docId));
    expect(chunksBefore).toHaveLength(1);

    // Second run (simulate retry)
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '["TopicB"]' } }]
      })
    });
    await processDocument(env, docId);

    // Assert chunks are still 1 (not duplicated)
    const chunksAfter = await db.select().from(chunk).where(eq(chunk.documentId, docId));
    expect(chunksAfter).toHaveLength(1);

    // Assert only linked to TopicB (TopicA link deleted)
    const links = await db.select().from(documentTopic).where(eq(documentTopic.documentId, docId));
    expect(links).toHaveLength(1);
    
    const linkedTopic = await db.select().from(topic).where(eq(topic.id, links[0].topicId));
    expect(linkedTopic[0].name).toBe('TopicB');
  });
});
