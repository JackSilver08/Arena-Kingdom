import { Client, type Room } from 'colyseus.js';
import {
  BotController,
  DIFFICULTY_LABELS,
  MatchEngine,
  decodeSnapshot,
  opponentOf,
  type Command,
  type Difficulty,
  type EncodedSnapshot,
  type GameEvent,
  type MatchMode,
  type MatchResult,
  type MatchView,
  type RatingChange,
  type RoomEndMessage,
  type RoomLobbyMessage,
  type RoomWelcomeMessage,
  type Side
} from '@arena-kingdom/shared';
import { SERVER_URL, api } from '../lib/api';
import { session as auth } from '../lib/session';

export interface SessionPlayer {
  side: Side;
  name: string;
  avatar: string;
  username: string | null;
  rating: number | null;
  isBot: boolean;
  connected: boolean;
}

export type SessionStatus = 'waiting' | 'countdown' | 'playing' | 'reconnecting' | 'ended' | 'closed';

export interface SessionEnd {
  result: MatchResult;
  matchId: string | null;
  ratings: RatingChange[];
  /** Whether the result made it into the match history. */
  saved: 'saved' | 'saving' | 'guest' | 'failed';
}

export type SessionSignal =
  | { type: 'notice'; ok: boolean; text: string }
  | { type: 'status' }
  | { type: 'players' }
  | { type: 'end' };

export abstract class GameSession {
  abstract readonly mode: MatchMode;
  mySide: Side = 'blue';
  view: MatchView | null = null;
  status: SessionStatus = 'waiting';
  countdownEndsAt = 0;
  end: SessionEnd | null = null;
  difficulty: Difficulty | null = null;
  roomId: string | null = null;
  isPrivate = false;
  players: Record<Side, SessionPlayer> = {
    blue: { side: 'blue', name: 'Blue kingdom', avatar: '🔵', username: null, rating: null, isBot: false, connected: true },
    red: { side: 'red', name: 'Red kingdom', avatar: '🔴', username: null, rating: null, isBot: false, connected: true }
  };
  private listeners = new Set<(signal: SessionSignal) => void>();

  get enemySide() {
    return opponentOf(this.mySide);
  }

  /** Advances the match (local) or collects network events (online). */
  abstract update(deltaMs: number): GameEvent[];
  abstract send(command: Command): void;
  abstract dispose(): void;

  on(listener: (signal: SessionSignal) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  protected emit(signal: SessionSignal) {
    for (const listener of this.listeners) listener(signal);
  }
}

// ------------------------------------------------------------------ vs AI

export class LocalSession extends GameSession {
  readonly mode = 'ai';
  private engine = new MatchEngine();
  private bot: BotController;
  private disposed = false;

  constructor(difficulty: Difficulty) {
    super();
    this.difficulty = difficulty;
    this.bot = new BotController('red', difficulty);
    const user = auth.user;
    this.players.blue = {
      side: 'blue',
      name: user?.displayName ?? 'You',
      avatar: user?.avatar ?? '🛡️',
      username: user?.username ?? null,
      rating: null,
      isBot: false,
      connected: true
    };
    this.players.red = {
      side: 'red',
      name: `${DIFFICULTY_LABELS[difficulty]} AI`,
      avatar: '🤖',
      username: null,
      rating: null,
      isBot: true,
      connected: true
    };
    this.view = this.engine.state;
    this.status = 'playing';
  }

  update(deltaMs: number) {
    if (this.disposed) return [];
    if (!this.engine.ended) {
      this.bot.update(this.engine, deltaMs);
      this.engine.update(deltaMs);
    }
    const events = this.engine.drainEvents();
    if (this.engine.state.result && !this.end) this.finish(this.engine.state.result);
    return events;
  }

  send(command: Command) {
    const result = this.engine.command('blue', command);
    if (!result.ok) this.emit({ type: 'notice', ok: false, text: result.error });
    else if (result.message) this.emit({ type: 'notice', ok: true, text: result.message });
  }

  private finish(result: MatchResult) {
    this.status = 'ended';
    const user = auth.user;
    this.end = { result, matchId: null, ratings: [], saved: user ? 'saving' : 'guest' };
    this.emit({ type: 'status' });
    this.emit({ type: 'end' });
    if (!user || !this.difficulty) return;
    const { blue, red } = this.engine.state.players;
    api
      .reportAiMatch({
        difficulty: this.difficulty,
        side: 'blue',
        winner: result.winner,
        reason: result.reason,
        durationMs: result.timeMs,
        stats: { blue: blue.stats, red: red.stats }
      })
      .then(({ id }) => {
        if (this.end) this.end = { ...this.end, matchId: id, saved: 'saved' };
      })
      .catch(() => {
        if (this.end) this.end = { ...this.end, saved: 'failed' };
      })
      .finally(() => !this.disposed && this.emit({ type: 'end' }));
  }

  dispose() {
    this.disposed = true;
  }
}

// ------------------------------------------------------------------ online

const RECONNECT_KEY = 'ak.reconnect';
const RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_MS = 2500;

function colyseusEndpoint() {
  if (SERVER_URL) return SERVER_URL;
  // In development Vite proxies /colyseus to the game server.
  return import.meta.env.DEV ? `${window.location.origin}/colyseus` : window.location.origin;
}

export function clearReconnectToken() {
  storeReconnect(null);
}

function storeReconnect(token: string | null) {
  try {
    if (token) sessionStorage.setItem(RECONNECT_KEY, token);
    else sessionStorage.removeItem(RECONNECT_KEY);
  } catch {
    // Reconnection after a page reload is best-effort.
  }
}

export function storedReconnectToken() {
  try {
    return sessionStorage.getItem(RECONNECT_KEY);
  } catch {
    return null;
  }
}

/** Human-readable text for matchmaking failures. */
export function describeJoinError(error: unknown) {
  const e = error as { code?: number; message?: string };
  if (e.code === 401) return 'Your session expired. Please sign in again.';
  if (e.code === 409) return e.message || 'You are already in that room.';
  if (e.message?.includes('not found') || e.code === 4212) return 'No room found with that code. Check it and try again.';
  if (e.message?.includes('locked') || e.code === 4216) return 'That room is already full.';
  return e.message || 'Could not reach the game server.';
}

export class OnlineSession extends GameSession {
  readonly mode = 'pvp';
  private client: Client;
  private room!: Room;
  private events: GameEvent[] = [];
  private disposed = false;

  private constructor(client: Client, room: Room) {
    super();
    this.client = client;
    // Show the starting kingdoms during the countdown, before the first snapshot arrives.
    this.view = new MatchEngine().state;
    this.attach(room);
  }

  static async join(kind: 'ranked' | 'create' | 'code', code = '') {
    const client = new Client(colyseusEndpoint());
    const options = { token: auth.token };
    const room =
      kind === 'ranked'
        ? await client.joinOrCreate('arena', options)
        : kind === 'create'
          ? await client.create('arena', { ...options, private: true })
          : await client.joinById(code.trim(), options);
    return new OnlineSession(client, room);
  }

  static async reconnect(token: string) {
    const client = new Client(colyseusEndpoint());
    const room = await client.reconnect(token);
    const session = new OnlineSession(client, room);
    session.status = 'playing';
    return session;
  }

  private attach(room: Room) {
    this.room = room;
    storeReconnect(room.reconnectionToken);

    room.onMessage('welcome', (message: RoomWelcomeMessage) => {
      this.mySide = message.side;
      this.roomId = message.roomId;
      this.isPrivate = message.isPrivate;
      this.emit({ type: 'players' });
    });

    room.onMessage('lobby', (message: RoomLobbyMessage) => {
      this.roomId = message.roomId;
      this.isPrivate = message.isPrivate;
      for (const player of message.players) {
        this.players[player.side] = {
          side: player.side,
          name: player.displayName,
          avatar: player.avatar,
          username: player.username,
          rating: player.rating,
          isBot: false,
          connected: player.connected
        };
      }
      const seated = new Set(message.players.map((p) => p.side));
      for (const side of ['blue', 'red'] as const) {
        if (!seated.has(side)) this.players[side] = { ...this.players[side], name: 'Waiting…', avatar: '⌛', username: null, rating: null };
      }
      if (message.phase === 'countdown') this.countdownEndsAt = performance.now() + message.countdownMs;
      if (this.status !== 'reconnecting' || message.phase === 'ended') this.status = message.phase;
      this.emit({ type: 'players' });
      this.emit({ type: 'status' });
    });

    room.onMessage('s', (snapshot: EncodedSnapshot) => {
      const { view, events } = decodeSnapshot(snapshot);
      this.view = view;
      this.events.push(...events);
    });

    room.onMessage('notice', (message: { ok: boolean; message?: string; error?: string }) => {
      const text = message.ok ? message.message : message.error;
      if (text) this.emit({ type: 'notice', ok: message.ok, text });
    });

    room.onMessage('end', (message: RoomEndMessage) => {
      this.end = { ...message, saved: message.matchId ? 'saved' : 'failed' };
      this.status = 'ended';
      storeReconnect(null);
      const mine = message.ratings.find((r) => r.side === this.mySide);
      if (mine && auth.user) auth.setUser({ ...auth.user, rating: mine.after });
      this.emit({ type: 'status' });
      this.emit({ type: 'end' });
    });

    room.onLeave((code) => {
      if (this.disposed || this.room !== room) return;
      // 4000 = left on purpose; a finished match is also not worth reconnecting to.
      if (code === 4000 || code === 1000 || this.status === 'ended' || this.status === 'waiting') {
        if (this.status !== 'ended') {
          this.status = 'closed';
          storeReconnect(null);
          this.emit({ type: 'status' });
        }
        return;
      }
      void this.reconnectLoop(room.reconnectionToken);
    });
  }

  private async reconnectLoop(token: string) {
    this.status = 'reconnecting';
    this.emit({ type: 'status' });
    for (let attempt = 0; attempt < RECONNECT_ATTEMPTS && !this.disposed; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
      try {
        const room = await this.client.reconnect(token);
        if (this.disposed) {
          void room.leave(true);
          return;
        }
        this.attach(room);
        this.status = 'playing';
        this.emit({ type: 'status' });
        this.emit({ type: 'notice', ok: true, text: 'Reconnected to the battle.' });
        return;
      } catch {
        // Try again until the server's reconnection window closes.
      }
    }
    if (this.disposed) return;
    this.status = 'closed';
    storeReconnect(null);
    this.emit({ type: 'status' });
    this.emit({ type: 'notice', ok: false, text: 'Connection to the battle was lost.' });
  }

  update() {
    const events = this.events;
    this.events = [];
    return events;
  }

  send(command: Command) {
    if (this.status === 'playing') this.room.send('cmd', command);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.status !== 'ended') storeReconnect(null);
    void this.room.leave(true).catch(() => undefined);
  }
}

// Hand-off from the lobby page to the battle page.
let pending: GameSession | null = null;

export function setPendingSession(session: GameSession) {
  pending = session;
}

export function takePendingSession() {
  const session = pending;
  pending = null;
  return session;
}
