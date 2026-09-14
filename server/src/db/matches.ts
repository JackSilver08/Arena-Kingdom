import { randomBytes } from 'node:crypto';
import type {
  Difficulty,
  EndReason,
  MatchListResponse,
  MatchMode,
  MatchOutcome,
  MatchParticipant,
  MatchSummary,
  PlayerStats,
  RatingChange,
  Side
} from '@arena-kingdom/shared';
import { emptyStats } from '@arena-kingdom/shared';
import { db, now, transaction } from './database.js';
import { findUserById, setRating } from './users.js';

const RATING_K = 32;

export function eloDelta(rating: number, opponent: number, score: number) {
  const expected = 1 / (1 + 10 ** ((opponent - rating) / 400));
  return Math.round(RATING_K * (score - expected));
}

interface MatchRow {
  id: string;
  mode: MatchMode;
  difficulty: Difficulty | null;
  end_reason: EndReason;
  winner_side: Side | null;
  duration_ms: number;
  ended_at: string;
}

interface PlayerRow {
  match_id: string;
  side: Side;
  user_id: number | null;
  username: string | null;
  display_name: string;
  avatar: string;
  is_bot: number;
  outcome: MatchOutcome;
  rating_before: number | null;
  rating_after: number | null;
  stats: string;
}

const statements = {
  insertMatch: db.prepare(
    'INSERT INTO matches (id, mode, difficulty, end_reason, winner_side, duration_ms, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ),
  insertPlayer: db.prepare(`
    INSERT INTO match_players (match_id, side, user_id, display_name, avatar, is_bot, outcome, rating_before, rating_after, stats)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  byId: db.prepare('SELECT * FROM matches WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) AS n FROM matches'),
  lastAiMatchAt: db.prepare(`
    SELECT MAX(m.ended_at) AS endedAt FROM matches m JOIN match_players mp ON mp.match_id = m.id
    WHERE mp.user_id = ? AND m.mode = 'ai'
  `)
};

function outcomeFor(side: Side, winner: Side | null): MatchOutcome {
  if (winner === null) return 'draw';
  return winner === side ? 'win' : 'loss';
}

function newMatchId() {
  return randomBytes(9).toString('base64url');
}

export interface PvpSeat {
  side: Side;
  userId: number;
  displayName: string;
  avatar: string;
}

export function recordPvpMatch(input: {
  seats: PvpSeat[];
  rated: boolean;
  winner: Side | null;
  reason: EndReason;
  durationMs: number;
  stats: Record<Side, PlayerStats>;
}): { id: string; ratings: RatingChange[] } {
  return transaction(() => {
    const id = newMatchId();
    statements.insertMatch.run(id, 'pvp', null, input.reason, input.winner, Math.round(input.durationMs), now());
    const current = input.seats.map((seat) => ({ seat, rating: findUserById(seat.userId)?.rating ?? 1000 }));
    const ratings: RatingChange[] = [];
    for (const { seat, rating } of current) {
      const opponent = current.find((entry) => entry.seat.side !== seat.side);
      const outcome = outcomeFor(seat.side, input.winner);
      const score = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;
      const after = opponent ? Math.max(100, rating + eloDelta(rating, opponent.rating, score)) : rating;
      statements.insertPlayer.run(
        id,
        seat.side,
        seat.userId,
        seat.displayName,
        seat.avatar,
        0,
        outcome,
        input.rated ? rating : null,
        input.rated ? after : null,
        JSON.stringify(input.stats[seat.side])
      );
      if (input.rated) ratings.push({ userId: seat.userId, side: seat.side, before: rating, after });
    }
    for (const change of ratings) setRating(change.userId, change.after);
    return { id, ratings };
  });
}

export function recordAiMatch(input: {
  userId: number;
  displayName: string;
  avatar: string;
  side: Side;
  difficulty: Difficulty;
  botName: string;
  winner: Side | null;
  reason: EndReason;
  durationMs: number;
  stats: Record<Side, PlayerStats>;
}) {
  return transaction(() => {
    const id = newMatchId();
    const botSide: Side = input.side === 'blue' ? 'red' : 'blue';
    statements.insertMatch.run(id, 'ai', input.difficulty, input.reason, input.winner, Math.round(input.durationMs), now());
    statements.insertPlayer.run(
      id,
      input.side,
      input.userId,
      input.displayName,
      input.avatar,
      0,
      outcomeFor(input.side, input.winner),
      null,
      null,
      JSON.stringify(input.stats[input.side])
    );
    statements.insertPlayer.run(
      id,
      botSide,
      null,
      input.botName,
      '🤖',
      1,
      outcomeFor(botSide, input.winner),
      null,
      null,
      JSON.stringify(input.stats[botSide])
    );
    return id;
  });
}

export function lastAiMatchAt(userId: number) {
  return (statements.lastAiMatchAt.get(userId) as { endedAt: string | null }).endedAt;
}

export function countMatches() {
  return (statements.count.get() as { n: number }).n;
}

function parseStats(json: string): PlayerStats {
  try {
    return { ...emptyStats(), ...(JSON.parse(json) as Partial<PlayerStats>) };
  } catch {
    return emptyStats();
  }
}

function hydrate(rows: MatchRow[]): MatchSummary[] {
  if (!rows.length) return [];
  const placeholders = rows.map(() => '?').join(', ');
  const players = db
    .prepare(
      `SELECT mp.*, u.username FROM match_players mp LEFT JOIN users u ON u.id = mp.user_id
       WHERE mp.match_id IN (${placeholders}) ORDER BY mp.side ASC`
    )
    .all(...rows.map((row) => row.id)) as unknown as PlayerRow[];
  const bySide = new Map<string, MatchParticipant[]>();
  for (const p of players) {
    const list = bySide.get(p.match_id) ?? [];
    list.push({
      side: p.side,
      userId: p.user_id,
      username: p.username,
      displayName: p.display_name,
      avatar: p.avatar,
      isBot: p.is_bot === 1,
      outcome: p.outcome,
      ratingBefore: p.rating_before,
      ratingAfter: p.rating_after,
      stats: parseStats(p.stats)
    });
    bySide.set(p.match_id, list);
  }
  return rows.map((row) => ({
    id: row.id,
    mode: row.mode,
    rated: (bySide.get(row.id) ?? []).some((p) => p.ratingBefore !== null),
    difficulty: row.difficulty,
    endReason: row.end_reason,
    winnerSide: row.winner_side,
    durationMs: row.duration_ms,
    endedAt: row.ended_at,
    players: bySide.get(row.id) ?? []
  }));
}

export function getMatch(id: string) {
  const row = statements.byId.get(id) as MatchRow | undefined;
  return row ? hydrate([row])[0] : null;
}

export function listMatches(options: { userId?: number; mode?: MatchMode; limit: number; offset: number }): MatchListResponse {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (options.userId !== undefined) {
    where.push('EXISTS (SELECT 1 FROM match_players mp WHERE mp.match_id = m.id AND mp.user_id = ?)');
    params.push(options.userId);
  }
  if (options.mode) {
    where.push('m.mode = ?');
    params.push(options.mode);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM matches m ${clause}`).get(...params) as { n: number }).n;
  const rows = db
    .prepare(`SELECT m.* FROM matches m ${clause} ORDER BY m.ended_at DESC, m.rowid DESC LIMIT ? OFFSET ?`)
    .all(...params, options.limit, options.offset) as unknown as MatchRow[];
  return { matches: hydrate(rows), total };
}
