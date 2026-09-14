import type { CurrentUser, Difficulty, LeaderboardEntry, ModeRecord, PublicUser, UserStatsSummary } from '@arena-kingdom/shared';
import { db, now } from './database.js';

interface UserRow {
  id: number;
  username: string;
  display_name: string;
  password_hash: string;
  avatar: string;
  rating: number;
  peak_rating: number;
  created_at: string;
  last_login_at: string | null;
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatar: row.avatar,
    rating: row.rating,
    createdAt: row.created_at
  };
}

export function toCurrentUser(row: UserRow): CurrentUser {
  return { ...toPublicUser(row), lastLoginAt: row.last_login_at };
}

const statements = {
  insert: db.prepare(
    'INSERT INTO users (username, display_name, password_hash, avatar, created_at) VALUES (?, ?, ?, ?, ?) RETURNING *'
  ),
  byUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  byId: db.prepare('SELECT * FROM users WHERE id = ?'),
  updateProfile: db.prepare('UPDATE users SET display_name = ?, avatar = ? WHERE id = ? RETURNING *'),
  updatePassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
  touchLogin: db.prepare('UPDATE users SET last_login_at = ? WHERE id = ? RETURNING *'),
  setRating: db.prepare('UPDATE users SET rating = ?, peak_rating = MAX(peak_rating, ?) WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) AS n FROM users'),
  hasRated: db.prepare('SELECT 1 AS yes FROM match_players WHERE user_id = ? AND rating_before IS NOT NULL LIMIT 1'),
  rank: db.prepare(`
    SELECT COUNT(*) + 1 AS rank FROM users u
    WHERE u.rating > ? AND EXISTS (
      SELECT 1 FROM match_players mp
      WHERE mp.user_id = u.id AND mp.rating_before IS NOT NULL
    )
  `),
  records: db.prepare(`
    SELECT m.mode, m.difficulty, mp.outcome, COUNT(*) AS n
    FROM match_players mp JOIN matches m ON m.id = mp.match_id
    WHERE mp.user_id = ?
    GROUP BY m.mode, m.difficulty, mp.outcome
  `),
  totals: db.prepare(`
    SELECT
      COALESCE(SUM(json_extract(mp.stats, '$.unitsTrained')), 0) AS unitsTrained,
      COALESCE(SUM(json_extract(mp.stats, '$.kills')), 0) AS kills,
      COALESCE(SUM(json_extract(mp.stats, '$.buildingsBuilt')), 0) AS buildingsBuilt,
      COALESCE(SUM(json_extract(mp.stats, '$.buildingsDestroyed')), 0) AS buildingsDestroyed,
      COALESCE(SUM(json_extract(mp.stats, '$.goldEarned')), 0) AS goldEarned,
      COALESCE(SUM(m.duration_ms), 0) AS playTimeMs
    FROM match_players mp JOIN matches m ON m.id = mp.match_id
    WHERE mp.user_id = ?
  `),
  leaderboard: db.prepare(`
    SELECT u.*,
      COUNT(*) AS played,
      SUM(mp.outcome = 'win') AS wins,
      SUM(mp.outcome = 'loss') AS losses,
      SUM(mp.outcome = 'draw') AS draws
    FROM users u
    JOIN match_players mp ON mp.user_id = u.id AND mp.rating_before IS NOT NULL
    GROUP BY u.id
    ORDER BY u.rating DESC, wins DESC, u.id ASC
    LIMIT ?
  `)
};

export function createUser(input: { username: string; displayName: string; passwordHash: string; avatar: string }) {
  const row = statements.insert.get(input.username, input.displayName, input.passwordHash, input.avatar, now()) as unknown as UserRow;
  return toCurrentUser(row);
}

export function findUserByUsername(username: string) {
  return statements.byUsername.get(username) as UserRow | undefined;
}

export function findUserById(id: number) {
  return statements.byId.get(id) as UserRow | undefined;
}

export function updateProfile(id: number, displayName: string, avatar: string) {
  return toCurrentUser(statements.updateProfile.get(displayName, avatar, id) as unknown as UserRow);
}

export function updatePassword(id: number, passwordHash: string) {
  statements.updatePassword.run(passwordHash, id);
}

export function touchLogin(id: number) {
  return toCurrentUser(statements.touchLogin.get(now(), id) as unknown as UserRow);
}

export function setRating(id: number, rating: number) {
  statements.setRating.run(rating, rating, id);
}

export function countUsers() {
  return (statements.count.get() as { n: number }).n;
}

const emptyRecord = (): ModeRecord => ({ played: 0, wins: 0, losses: 0, draws: 0 });

function addOutcome(record: ModeRecord, outcome: string, n: number) {
  record.played += n;
  if (outcome === 'win') record.wins += n;
  else if (outcome === 'loss') record.losses += n;
  else record.draws += n;
}

export function statsSummary(user: UserRow): UserStatsSummary {
  const pvp = emptyRecord();
  const byDifficulty: Record<Difficulty, ModeRecord> = { easy: emptyRecord(), normal: emptyRecord(), hard: emptyRecord() };
  const ai = { ...emptyRecord(), byDifficulty };
  const rows = statements.records.all(user.id) as { mode: string; difficulty: Difficulty | null; outcome: string; n: number }[];
  for (const row of rows) {
    if (row.mode === 'pvp') {
      addOutcome(pvp, row.outcome, row.n);
    } else {
      addOutcome(ai, row.outcome, row.n);
      if (row.difficulty && byDifficulty[row.difficulty]) addOutcome(byDifficulty[row.difficulty], row.outcome, row.n);
    }
  }
  const totals = statements.totals.get(user.id) as unknown as UserStatsSummary['totals'];
  return { pvp, ai, totals, peakRating: user.peak_rating };
}

export function rankOf(user: UserRow) {
  if (!statements.hasRated.get(user.id)) return null;
  return (statements.rank.get(user.rating) as { rank: number }).rank;
}

export function leaderboard(limit: number): LeaderboardEntry[] {
  const rows = statements.leaderboard.all(limit) as unknown as (UserRow & ModeRecord)[];
  return rows.map((row, index) => ({
    rank: index + 1,
    user: toPublicUser(row),
    played: row.played,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws
  }));
}
