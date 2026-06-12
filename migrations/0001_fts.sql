-- Caveat from PLAN.md:
-- D1 databases containing virtual tables cannot be exported.
-- The FTS table must be dropped and recreated around any `wrangler d1 export` backup.

CREATE VIRTUAL TABLE chunk_fts USING fts5(chunk_id UNINDEXED, content);

-- Trigger to keep FTS table in sync on INSERT
CREATE TRIGGER after_chunk_insert AFTER INSERT ON chunk
BEGIN
  INSERT INTO chunk_fts(chunk_id, content) VALUES (new.id, new.content);
END;

-- Trigger to keep FTS table in sync on UPDATE
CREATE TRIGGER after_chunk_update AFTER UPDATE ON chunk
BEGIN
  UPDATE chunk_fts SET content = new.content WHERE chunk_id = old.id;
END;

-- Trigger to keep FTS table in sync on DELETE
CREATE TRIGGER after_chunk_delete AFTER DELETE ON chunk
BEGIN
  DELETE FROM chunk_fts WHERE chunk_id = old.id;
END;
