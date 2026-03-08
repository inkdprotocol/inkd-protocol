-- INKD Indexer schema (SQLite)
-- Run via: sqlite3 data/indexer.db < scripts/indexer-schema.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id              INTEGER PRIMARY KEY,
  owner           TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  license         TEXT,
  readme_hash     TEXT,
  is_public       INTEGER NOT NULL DEFAULT 1,
  is_agent        INTEGER NOT NULL DEFAULT 0,
  agent_endpoint  TEXT,
  metadata_uri    TEXT,
  fork_of         INTEGER DEFAULT 0,
  access_manifest TEXT,
  tags_hash       TEXT,
  version_count   INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS versions (
  project_id    INTEGER NOT NULL,
  version_index INTEGER NOT NULL,
  arweave_hash  TEXT NOT NULL,
  version_tag   TEXT NOT NULL,
  changelog     TEXT,
  pushed_by     TEXT NOT NULL,
  agent_address TEXT,
  meta_hash     TEXT,
  pushed_at     INTEGER NOT NULL,
  PRIMARY KEY(project_id, version_index),
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settlements (
  tx_hash        TEXT PRIMARY KEY,
  project_id     INTEGER,
  payer          TEXT,
  amount_usdc    TEXT,
  arweave_cost   TEXT,
  markup_amount  TEXT,
  block_number   INTEGER,
  block_time     INTEGER,
  created_at     INTEGER NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS cursors (
  source      TEXT PRIMARY KEY,
  cursor      TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_versions_project_time ON versions(project_id, pushed_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner);
