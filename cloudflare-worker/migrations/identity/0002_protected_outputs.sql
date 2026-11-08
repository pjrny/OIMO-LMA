-- Protected outputs: every generated asset registered with the AssetID protocol,
-- linked back to the identity that approved it.

CREATE TABLE IF NOT EXISTS protected_outputs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identity_id INTEGER NOT NULL REFERENCES identities(id),
  asset_id TEXT NOT NULL,
  watermark_id TEXT,
  sha256 TEXT,
  title TEXT,
  mime_type TEXT,
  verification_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_outputs_identity ON protected_outputs(identity_id);
CREATE INDEX IF NOT EXISTS idx_outputs_asset ON protected_outputs(asset_id);
