import { createHash, randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { db, now } from './database.js';
import { findUserById, toCurrentUser } from './users.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const statements = {
  insert: db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'),
  find: db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?'),
  remove: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  removeOthers: db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?'),
  purge: db.prepare('DELETE FROM sessions WHERE expires_at < ?')
};

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function createSession(userId: number) {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + config.sessionTtlDays * DAY_MS).toISOString();
  statements.insert.run(hashToken(token), userId, now(), expires);
  return token;
}

export function userForToken(token: string | undefined | null) {
  if (!token || token.length > 128) return null;
  const session = statements.find.get(hashToken(token)) as { user_id: number; expires_at: string } | undefined;
  if (!session) return null;
  if (session.expires_at < now()) {
    statements.remove.run(hashToken(token));
    return null;
  }
  const row = findUserById(session.user_id);
  return row ? { row, user: toCurrentUser(row) } : null;
}

export function deleteSession(token: string) {
  statements.remove.run(hashToken(token));
}

export function deleteOtherSessions(userId: number, keepToken: string) {
  statements.removeOthers.run(userId, hashToken(keepToken));
}

export function purgeExpiredSessions() {
  statements.purge.run(now());
}
