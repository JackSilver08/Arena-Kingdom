import { Router } from 'express';
import { matchMaker } from 'colyseus';
import {
  ACCOUNT_RULES,
  AVATARS,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  GAME_RULES,
  GAME_VERSION,
  STAT_KEYS,
  emptyStats,
  type AiMatchReport,
  type AuthResponse,
  type Difficulty,
  type EndReason,
  type MatchMode,
  type OverviewStats,
  type PlayerStats,
  type ProfileResponse,
  type Side
} from '@arena-kingdom/shared';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { countMatches, getMatch, lastAiMatchAt, listMatches, recordAiMatch } from '../db/matches.js';
import { createSession, deleteOtherSessions, deleteSession } from '../db/sessions.js';
import {
  countUsers,
  createUser,
  findUserByUsername,
  leaderboard,
  rankOf,
  statsSummary,
  toPublicUser,
  touchLogin,
  updatePassword,
  updateProfile
} from '../db/users.js';
import { HttpError, auth, rateLimit, requireAuth } from './middleware.js';

// Used to keep login timing similar whether or not the username exists.
const DUMMY_HASH = await hashPassword('arena-kingdom-dummy-password');

const authLimiter = rateLimit({ windowMs: 10 * 60_000, max: 20, message: 'Too many attempts. Please wait a few minutes.' });

function str(value: unknown, field: string) {
  if (typeof value !== 'string') throw new HttpError(400, `${field} is required.`);
  return value;
}

function validateUsername(value: unknown) {
  const username = str(value, 'Username').trim();
  const { min, max, pattern } = ACCOUNT_RULES.username;
  if (username.length < min || username.length > max || !pattern.test(username)) {
    throw new HttpError(400, `Username must be ${min}-${max} characters: letters, numbers or underscores.`);
  }
  return username;
}

function validateDisplayName(value: unknown) {
  // Strip control characters and collapse whitespace.
  const name = str(value, 'Display name')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const { min, max } = ACCOUNT_RULES.displayName;
  if ([...name].length < min || [...name].length > max) {
    throw new HttpError(400, `Display name must be ${min}-${max} characters.`);
  }
  return name;
}

function validatePassword(value: unknown, field = 'Password') {
  const password = str(value, field);
  const { min, max } = ACCOUNT_RULES.password;
  if (password.length < min || password.length > max) {
    throw new HttpError(400, `${field} must be ${min}-${max} characters.`);
  }
  return password;
}

function validateAvatar(value: unknown) {
  if (typeof value !== 'string' || !(AVATARS as readonly string[]).includes(value)) {
    throw new HttpError(400, 'Choose one of the available avatars.');
  }
  return value;
}

function pageParams(query: Record<string, unknown>) {
  const limit = Math.min(Math.max(Number.parseInt(String(query.limit ?? '20'), 10) || 20, 1), 50);
  const offset = Math.max(Number.parseInt(String(query.offset ?? '0'), 10) || 0, 0);
  const mode = query.mode === 'ai' || query.mode === 'pvp' ? (query.mode as MatchMode) : undefined;
  return { limit, offset, mode };
}

const SIDES: Side[] = ['blue', 'red'];
const REASONS: EndReason[] = ['castle', 'surrender', 'peace', 'timeout'];

function validateStats(value: unknown): PlayerStats {
  if (!value || typeof value !== 'object') throw new HttpError(400, 'Invalid match statistics.');
  const stats = emptyStats();
  for (const key of STAT_KEYS) {
    const n = (value as Record<string, unknown>)[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 10_000_000) {
      throw new HttpError(400, 'Invalid match statistics.');
    }
    stats[key] = Math.round(n);
  }
  return stats;
}

function validateAiReport(body: unknown): AiMatchReport {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!DIFFICULTIES.includes(b.difficulty as Difficulty)) throw new HttpError(400, 'Invalid difficulty.');
  if (!SIDES.includes(b.side as Side)) throw new HttpError(400, 'Invalid side.');
  if (b.winner !== null && !SIDES.includes(b.winner as Side)) throw new HttpError(400, 'Invalid winner.');
  if (!REASONS.includes(b.reason as EndReason)) throw new HttpError(400, 'Invalid end reason.');
  if ((b.reason === 'peace') !== (b.winner === null) && b.reason !== 'timeout') throw new HttpError(400, 'Inconsistent result.');
  const durationMs = b.durationMs;
  if (typeof durationMs !== 'number' || durationMs < 1000 || durationMs > GAME_RULES.maxMatchMs + 60_000) {
    throw new HttpError(400, 'Invalid match duration.');
  }
  const stats = (b.stats ?? {}) as Record<string, unknown>;
  return {
    difficulty: b.difficulty as Difficulty,
    side: b.side as Side,
    winner: b.winner as Side | null,
    reason: b.reason as EndReason,
    durationMs,
    stats: { blue: validateStats(stats.blue), red: validateStats(stats.red) }
  };
}

function profileFor(username: string): ProfileResponse {
  const row = findUserByUsername(username);
  if (!row) throw new HttpError(404, 'Player not found.');
  const stats = statsSummary(row);
  return { user: toPublicUser(row), stats, rank: rankOf(row) };
}

export function createApiRouter() {
  const api = Router();

  api.get('/health', (_req, res) => {
    res.json({ ok: true, game: 'arena-kingdom', version: GAME_VERSION });
  });

  api.get('/overview', async (_req, res) => {
    const rooms = await matchMaker.query({ name: 'arena' });
    const overview: OverviewStats = {
      players: countUsers(),
      matches: countMatches(),
      onlineRooms: rooms.length,
      onlinePlayers: rooms.reduce((sum, room) => sum + room.clients, 0)
    };
    res.json(overview);
  });

  // ------------------------------------------------------------------ auth

  api.post('/auth/register', authLimiter, async (req, res) => {
    const username = validateUsername(req.body?.username);
    const password = validatePassword(req.body?.password);
    const displayName = req.body?.displayName ? validateDisplayName(req.body.displayName) : username;
    const avatar = req.body?.avatar ? validateAvatar(req.body.avatar) : AVATARS[Math.floor(Math.random() * AVATARS.length)];
    if (findUserByUsername(username)) throw new HttpError(409, 'That username is already taken.');
    const passwordHash = await hashPassword(password);
    let user;
    try {
      user = createUser({ username, displayName, passwordHash, avatar });
    } catch (error) {
      if (String(error).includes('UNIQUE')) throw new HttpError(409, 'That username is already taken.');
      throw error;
    }
    const body: AuthResponse = { token: createSession(user.id), user: touchLogin(user.id) };
    res.status(201).json(body);
  });

  api.post('/auth/login', authLimiter, async (req, res) => {
    const username = str(req.body?.username, 'Username').trim();
    const password = str(req.body?.password, 'Password');
    const row = findUserByUsername(username);
    const valid = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !valid) throw new HttpError(401, 'Incorrect username or password.');
    const body: AuthResponse = { token: createSession(row.id), user: touchLogin(row.id) };
    res.json(body);
  });

  api.post('/auth/logout', requireAuth, (_req, res) => {
    deleteSession(auth(res).token);
    res.status(204).end();
  });

  api.get('/auth/me', requireAuth, (_req, res) => {
    res.json({ user: auth(res).user });
  });

  // -------------------------------------------------------------- account

  api.patch('/me', requireAuth, (req, res) => {
    const { user } = auth(res);
    const displayName = req.body?.displayName !== undefined ? validateDisplayName(req.body.displayName) : user.displayName;
    const avatar = req.body?.avatar !== undefined ? validateAvatar(req.body.avatar) : user.avatar;
    res.json({ user: updateProfile(user.id, displayName, avatar) });
  });

  api.post('/me/password', requireAuth, authLimiter, async (req, res) => {
    const { userRow, token } = auth(res);
    const current = str(req.body?.currentPassword, 'Current password');
    const next = validatePassword(req.body?.newPassword, 'New password');
    if (!(await verifyPassword(current, userRow.password_hash))) throw new HttpError(400, 'Current password is incorrect.');
    updatePassword(userRow.id, await hashPassword(next));
    deleteOtherSessions(userRow.id, token);
    res.json({ ok: true });
  });

  api.get('/me/profile', requireAuth, (_req, res) => {
    res.json(profileFor(auth(res).user.username));
  });

  api.get('/me/matches', requireAuth, (req, res) => {
    res.json(listMatches({ userId: auth(res).user.id, ...pageParams(req.query) }));
  });

  // -------------------------------------------------------------- players

  api.get('/users/:username', (req, res) => {
    res.json(profileFor(req.params.username));
  });

  api.get('/users/:username/matches', (req, res) => {
    const row = findUserByUsername(req.params.username);
    if (!row) throw new HttpError(404, 'Player not found.');
    res.json(listMatches({ userId: row.id, ...pageParams(req.query) }));
  });

  api.get('/leaderboard', (req, res) => {
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 100);
    res.json({ entries: leaderboard(limit) });
  });

  // -------------------------------------------------------------- matches

  api.get('/matches', (req, res) => {
    res.json(listMatches(pageParams(req.query)));
  });

  api.get('/matches/:id', (req, res) => {
    const match = getMatch(req.params.id);
    if (!match) throw new HttpError(404, 'Match not found.');
    res.json(match);
  });

  api.post('/matches/ai', requireAuth, (req, res) => {
    const { user } = auth(res);
    const report = validateAiReport(req.body);
    const last = lastAiMatchAt(user.id);
    if (last && Date.now() - Date.parse(last) < 5000) throw new HttpError(429, 'Match already recorded.');
    const id = recordAiMatch({
      userId: user.id,
      displayName: user.displayName,
      avatar: user.avatar,
      side: report.side,
      difficulty: report.difficulty,
      botName: `${DIFFICULTY_LABELS[report.difficulty]} AI`,
      winner: report.winner,
      reason: report.reason,
      durationMs: report.durationMs,
      stats: report.stats
    });
    res.status(201).json({ id });
  });

  api.use((_req, _res, next) => next(new HttpError(404, 'Not found.')));

  return api;
}
