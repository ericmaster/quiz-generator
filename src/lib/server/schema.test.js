// @vitest-environment node
import { expect, test } from "vitest";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

test("D1 Schema Migration and FTS5 synchronization", () => {
  // 1. Initialize an in-memory SQLite database
  const db = new DatabaseSync(":memory:");

  // 2. Load and apply 0000_dashing_starbolt.sql
  const migration0 = fs.readFileSync(
    path.resolve("./migrations/0000_dashing_starbolt.sql"),
    "utf-8"
  );
  
  // Drizzle separates statements using --> statement-breakpoint
  const statements0 = migration0.split("--> statement-breakpoint");
  for (const stmt of statements0) {
    const trimmed = stmt.trim();
    if (trimmed) {
      db.exec(trimmed);
    }
  }

  // 3. Load and apply 0001_fts.sql (FTS5 table and triggers)
  const migration1 = fs.readFileSync(
    path.resolve("./migrations/0001_fts.sql"),
    "utf-8"
  );
  
  db.exec(migration1);

  // 4. Verify tables exist and schema is correct by inserting/querying a dummy user
  db.exec(`
    INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
    VALUES ('user-123', 'Test User', 'test@example.com', 0, 1600000000000, 1600000000000)
  `);

  const users = db.prepare("SELECT * FROM user WHERE id = ?").all("user-123");
  expect(users).toHaveLength(1);
  expect(users[0].name).toBe("Test User");
  expect(users[0].email).toBe("test@example.com");

  // 5. Verify document and chunk tables work with FKs
  db.exec(`
    INSERT INTO document (id, user_id, filename, mime_type, size_bytes, status, created_at)
    VALUES ('doc-123', 'user-123', 'test.txt', 'text/plain', 1024, 'ready', 1600000000000)
  `);

  db.exec(`
    INSERT INTO chunk (id, document_id, content, chunk_index)
    VALUES ('chunk-123', 'doc-123', 'Artificial Intelligence and Machine Learning are core concepts.', 0)
  `);

  const chunks = db.prepare("SELECT * FROM chunk WHERE id = ?").all("chunk-123");
  expect(chunks).toHaveLength(1);
  expect(chunks[0].content).toContain("Machine Learning");

  // 6. Verify that the FTS5 triggers correctly synchronized the chunk insert
  const ftsSearch = db.prepare("SELECT * FROM chunk_fts WHERE chunk_fts MATCH ?").all("Learning");
  expect(ftsSearch).toHaveLength(1);
  expect(ftsSearch[0].chunk_id).toBe("chunk-123");

  // 7. Verify chunk UPDATE synchronization
  db.exec(`
    UPDATE chunk SET content = 'Deep Learning is a subset of Machine Learning.' WHERE id = 'chunk-123'
  `);
  
  const ftsSearchUpdated = db.prepare("SELECT * FROM chunk_fts WHERE chunk_fts MATCH ?").all("Deep");
  expect(ftsSearchUpdated).toHaveLength(1);
  expect(ftsSearchUpdated[0].chunk_id).toBe("chunk-123");

  // 8. Verify chunk DELETE synchronization
  db.exec(`
    DELETE FROM chunk WHERE id = 'chunk-123'
  `);
  
  const ftsSearchDeleted = db.prepare("SELECT * FROM chunk_fts WHERE chunk_fts MATCH ?").all("Learning");
  expect(ftsSearchDeleted).toHaveLength(0);
});
