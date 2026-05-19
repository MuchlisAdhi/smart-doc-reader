-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Documents table: stores extracted document data
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  -- File metadata
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,           -- mime type, e.g. image/jpeg
  file_size INTEGER NOT NULL,         -- bytes
  storage_key TEXT NOT NULL,          -- R2 object key
  -- Extracted fields
  vendor TEXT,
  document_date TEXT,                 -- ISO date YYYY-MM-DD
  total REAL,
  subtotal REAL,
  tax REAL,
  currency TEXT,
  document_number TEXT,
  document_type TEXT,                 -- receipt | invoice | other
  notes TEXT,
  -- AI metadata
  raw_extraction TEXT,                -- JSON: full AI response
  confidence_overall REAL,            -- 0..1
  confidence_fields TEXT,             -- JSON: { vendor: 0.92, ... }
  ai_model TEXT,
  processing_time_ms INTEGER,
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | completed | failed | reviewed
  error_message TEXT,
  -- Audit
  is_verified INTEGER NOT NULL DEFAULT 0, -- 0 or 1, set to 1 when user reviewed
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_vendor ON documents(vendor);
CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(document_date);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);

-- Document line items (extracted item list)
CREATE TABLE IF NOT EXISTS document_items (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  quantity REAL,
  unit_price REAL,
  total REAL,
  confidence REAL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_items_document_id ON document_items(document_id);

-- Sessions table for JWT refresh / revocation tracking (optional, for token blacklist)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
