import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';

/** Ordered schema migrations. Append new entries; never edit applied ones. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    avatar TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 1000,
    peak_rating INTEGER NOT NULL DEFAULT 1000,
    created_at TEXT NOT NULL,
    last_login_at TEXT
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX idx_sessions_user ON sessions(user_id);

  CREATE TABLE matches (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL CHECK (mode IN ('ai', 'pvp')),
    difficulty TEXT,
    end_reason TEXT NOT NULL,
    winner_side TEXT,
    duration_ms INTEGER NOT NULL,
    ended_at TEXT NOT NULL
  );
  CREATE INDEX idx_matches_ended_at ON matches(ended_at);

  CREATE TABLE match_players (
    match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    side TEXT NOT NULL CHECK (side IN ('blue', 'red')),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    display_name TEXT NOT NULL,
    avatar TEXT NOT NULL,
    is_bot INTEGER NOT NULL DEFAULT 0,
    outcome TEXT NOT NULL CHECK (outcome IN ('win', 'loss', 'draw')),
    rating_before INTEGER,
    rating_after INTEGER,
    stats TEXT NOT NULL,
    PRIMARY KEY (match_id, side)
  );
  CREATE INDEX idx_match_players_user ON match_players(user_id);
  `
];

function open() {
  mkdirSync(path.dirname(config.databasePath), { recursive: true });
  const database = new DatabaseSync(config.databasePath);
  database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  database.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const row = database.prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations').get() as { version: number };
  for (let version = row.version + 1; version <= MIGRATIONS.length; version++) {
    database.exec('BEGIN');
    try {
      database.exec(MIGRATIONS[version - 1]);
      database.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, new Date().toISOString());
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
  return database;
}

export const db = open();

export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export const now = () => new Date().toISOString();
