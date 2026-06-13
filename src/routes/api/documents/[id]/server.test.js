// @vitest-environment node
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '$lib/server/db.js';
import { deleteDocument } from '$lib/server/documents.js';
import { DELETE } from './+server.js';
// Inject real D1 Mock creation in db.js getDb
vi.mock('$lib/server/db.js', () => {
  return {
    getDb: (envObj) => {
      const { drizzle } = require('drizzle-orm/d1');
      const schema = require('../../../../lib/server/schema.js');
      return drizzle(envObj.DB, { schema });
    }
  };
});

describe('Document deletion backend tests', () => {
  let nodeDb;
  let d1Mock;
  let fakeVectorize;
  let fakeBucket;
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
    
    // Load schema and FTS migrations
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
    fakeVectorize = {
      deleteByIds: vi.fn().mockResolvedValue({})
    };
    fakeBucket = {
      delete: vi.fn().mockResolvedValue({})
    };

    env = {
      DB: d1Mock,
      VECTORIZE: fakeVectorize,
      DOCS_BUCKET: fakeBucket
    };

    // Seed database
    nodeDb.exec(`
      INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
      VALUES ('user-alpha', 'Alpha User', 'alpha@example.com', 1, 1600000000000, 1600000000000);

      INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
      VALUES ('user-beta', 'Beta User', 'beta@example.com', 1, 1600000000000, 1600000000000);

      -- Topics
      INSERT INTO topic (id, user_id, name) VALUES ('topic-shared', 'user-alpha', 'Shared Topic');
      INSERT INTO topic (id, user_id, name) VALUES ('topic-unique', 'user-alpha', 'Unique Topic');

      -- Documents
      INSERT INTO document (id, user_id, filename, mime_type, size_bytes, status, r2_key, created_at)
      VALUES ('doc-target', 'user-alpha', 'doc_target.txt', 'text/plain', 500, 'ready', 'doc-target-r2-key', 1600000000000);

      INSERT INTO document (id, user_id, filename, mime_type, size_bytes, status, r2_key, created_at)
      VALUES ('doc-other', 'user-alpha', 'doc_other.txt', 'text/plain', 500, 'ready', 'doc-other-r2-key', 1600000000000);

      -- Links
      INSERT INTO document_topic (document_id, topic_id) VALUES ('doc-target', 'topic-shared');
      INSERT INTO document_topic (document_id, topic_id) VALUES ('doc-target', 'topic-unique');
      INSERT INTO document_topic (document_id, topic_id) VALUES ('doc-other', 'topic-shared');

      -- Chunks
      INSERT INTO chunk (id, document_id, content, chunk_index)
      VALUES ('chunk-target-1', 'doc-target', 'Target document chunk content.', 0);

      INSERT INTO chunk (id, document_id, content, chunk_index)
      VALUES ('chunk-other-1', 'doc-other', 'Other document chunk content.', 0);
    `);
  });

  afterEach(() => {
    nodeDb.close();
  });

  test('deleteDocument cleans up all records, keeps shared topic, deletes unique topic, and calls Vectorize/R2', async () => {
    // Perform deletion
    const result = await deleteDocument(env, 'user-alpha', 'doc-target');
    expect(result.success).toBe(true);

    // Verify Vectorize and R2 were called with correct keys
    expect(fakeVectorize.deleteByIds).toHaveBeenCalledWith(['chunk-target-1']);
    expect(fakeBucket.delete).toHaveBeenCalledWith('doc-target-r2-key');

    // Verify target document is deleted
    const targetDoc = nodeDb.prepare("SELECT * FROM document WHERE id = 'doc-target'").get();
    expect(targetDoc).toBeUndefined();

    // Verify chunks of target document are deleted
    const targetChunks = nodeDb.prepare("SELECT * FROM chunk WHERE document_id = 'doc-target'").all();
    expect(targetChunks).toHaveLength(0);

    // Verify document_topic links for target doc are deleted
    const targetLinks = nodeDb.prepare("SELECT * FROM document_topic WHERE document_id = 'doc-target'").all();
    expect(targetLinks).toHaveLength(0);

    // Verify that the UNIQUE topic is deleted (since it now has 0 documents linked)
    const uniqueTopic = nodeDb.prepare("SELECT * FROM topic WHERE id = 'topic-unique'").get();
    expect(uniqueTopic).toBeUndefined();

    // Verify that the SHARED topic is still retained (since doc-other is still linked to it)
    const sharedTopic = nodeDb.prepare("SELECT * FROM topic WHERE id = 'topic-shared'").get();
    expect(sharedTopic).toBeDefined();

    // Verify other document and its chunks/links are still intact
    const otherDoc = nodeDb.prepare("SELECT * FROM document WHERE id = 'doc-other'").get();
    expect(otherDoc).toBeDefined();
    const otherChunks = nodeDb.prepare("SELECT * FROM chunk WHERE document_id = 'doc-other'").all();
    expect(otherChunks).toHaveLength(1);
  });

  test('DELETE endpoint returns 401 if not authenticated', async () => {
    const mockEvent = {
      locals: { user: null },
      params: { id: 'doc-target' },
      platform: { env }
    };

    const res = await DELETE(mockEvent);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('DELETE endpoint returns 404 if document not owned by user', async () => {
    const mockEvent = {
      locals: { user: { id: 'user-beta' } }, // Beta user trying to delete alpha's document
      params: { id: 'doc-target' },
      platform: { env }
    };

    const res = await DELETE(mockEvent);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('Document not found or access denied');
  });

  test('DELETE endpoint returns 200 and performs delete on success', async () => {
    const mockEvent = {
      locals: { user: { id: 'user-alpha' } },
      params: { id: 'doc-target' },
      platform: { env }
    };

    const res = await DELETE(mockEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);

    // Verify DB state
    const targetDoc = nodeDb.prepare("SELECT * FROM document WHERE id = 'doc-target'").get();
    expect(targetDoc).toBeUndefined();
  });
});
