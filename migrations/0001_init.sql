CREATE TABLE IF NOT EXISTS digest_runs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  source TEXT NOT NULL,
  item_count INTEGER NOT NULL,
  ai_analysis INTEGER NOT NULL,
  message_text TEXT NOT NULL,
  analysis_text TEXT,
  source_items_json TEXT NOT NULL,
  feishu_push_ok INTEGER NOT NULL DEFAULT 0,
  push_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_digest_runs_created_at
  ON digest_runs(created_at DESC);
