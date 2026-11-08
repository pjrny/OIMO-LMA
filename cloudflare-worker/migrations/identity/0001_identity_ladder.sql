-- OIMO Identity verification ladder (Levels 0-8).
-- One row per verified identity, one row per level evidence submission.

CREATE TABLE IF NOT EXISTS identities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER,              -- Odoo res.partner id on the ERP (xxxooo)
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT -1,  -- highest COMPLETED level; -1 = record only
  status TEXT NOT NULL DEFAULT 'active', -- active | suspended
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS level_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identity_id INTEGER NOT NULL REFERENCES identities(id),
  level INTEGER NOT NULL,
  kind TEXT NOT NULL,              -- email | selfie | liveness_video | gov_id | consent_video | social_osint | therapist_attestation | twinflame_attestation
  evidence_ref TEXT,               -- R2 key or AssetID of the stored evidence
  evidence_sha256 TEXT,            -- sha256 of the submitted artifact
  payload TEXT,                    -- small JSON extras (handles, provider result, reviewer note)
  decision TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewer TEXT
);

CREATE INDEX IF NOT EXISTS idx_evidence_identity ON level_evidence(identity_id, level);
