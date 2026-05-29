CREATE TABLE IF NOT EXISTS builds (
  id TEXT PRIMARY KEY,
  app_name TEXT NOT NULL,
  app_name_en TEXT NOT NULL DEFAULT '',
  app_identifier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  workflow_run_id INTEGER,
  windows_url TEXT,
  android_url TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_builds_created_at ON builds(created_at DESC);
