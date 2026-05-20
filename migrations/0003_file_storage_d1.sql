-- Store files directly in D1 instead of R2 (no credit card required)
CREATE TABLE IF NOT EXISTS file_storage (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  data TEXT NOT NULL,            -- base64 encoded file content
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_file_storage_document_id ON file_storage(document_id);
