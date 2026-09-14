import { Room, ServerError, type Client, type Delayed } from 'colyseus';
import {
  GAME_RULES,
  MatchEngine,
  encodeSnapshot,
  parseCommand,
  type CurrentUser,
  type GameEvent,
  type RoomEndMessage,
  type RoomLobbyMessage,
  type RoomPhase,
  type RoomPlayer,
  type RoomWelcomeMessage,
  type Side
} from '@arena-kingdom/shared';
import { config } from '../config.js';
import { recordPvpMatch } from '../db/matches.js';
import { userForToken } from '../db/sessions.js';

const COUNTDOWN_MS = 3000;
const SNAPSHOT_MS = 100;
const COMMANDS_PER_SECOND = 20;
const ENDED_ROOM_TTL_MS = 10 * 60_000;

interface Seat extends RoomPlayer {
  sessionId: string;
}

interface ClientData {
  side: Side;
  commandWindowStart: number;
  commandCount: number;
}

export class ArenaRoom extends Room<object, { private: boolean }, ClientData, CurrentUser> {
  maxClients = 2;

  private seats = new Map<Side, Seat>();
  private phase: RoomPhase = 'waiting';
  private isPrivate = false;
  private engine: MatchEngine | null = null;
  private countdown: Delayed | null = null;
  private countdownEndsAt = 0;
  private sinceSnapshot = 0;
  private pendingEvents: GameEvent[] = [];
  private endMessage: RoomEndMessage | null = null;

  onCreate(options: { private?: unknown }) {
    this.isPrivate = options?.private === true;
    if (this.isPrivate) void this.setPrivate(true);
    void this.setMetadata({ private: this.isPrivate });
    this.onMessage('cmd', (client, payload) => this.handleCommand(client, payload));
  }

  /** Runs during HTTP matchmaking, so unauthenticated requests never reserve a seat. */
  static async onAuth(token: string, options: { token?: unknown }) {
    const session = userForToken(typeof options?.token === 'string' ? options.token : token);
    if (!session) throw new ServerError(401, 'Please sign in to play online.');
    return session.user;
  }

  onJoin(client: Client<ClientData, CurrentUser>, _options: unknown, user: CurrentUser) {
    for (const seat of this.seats.values()) {
      if (seat.userId === user.id) throw new ServerError(409, 'You are already seated in this match.');
    }
    const side: Side = this.seats.has('blue') ? 'red' : 'blue';
    this.seats.set(side, {
      side,
      sessionId: client.sessionId,
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      rating: user.rating,
      connected: true
    });
    client.userData = { side, commandWindowStart: 0, commandCount: 0 };
    this.sendWelcome(client, side);
    if (this.seats.size === 2) this.beginCountdown();
    this.broadcastLobby();
  }

  async onLeave(client: Client<ClientData, CurrentUser>, consented: boolean) {
    const side = client.userData?.side;
    const seat = side ? this.seats.get(side) : undefined;
    if (!side || !seat || seat.sessionId !== client.sessionId) return;

    if (this.phase === 'waiting' || this.phase === 'countdown') {
      this.seats.delete(side);
      this.cancelCountdown();
      this.broadcastLobby();
      return;
    }
    if (this.phase === 'ended') return;

    if (consented) {
      this.engine?.forfeit(side, 'surrender');
      return;
    }

    seat.connected = false;
    this.broadcastLobby();
    try {
      const rejoined = await this.allowReconnection(client, config.reconnectSeconds);
      seat.sessionId = rejoined.sessionId;
      seat.connected = true;
      rejoined.userData = { side, commandWindowStart: 0, commandCount: 0 };
      this.sendWelcome(rejoined, side);
      this.broadcastLobby();
      if (this.engine) rejoined.send('s', encodeSnapshot(this.engine.state, []));
      if (this.endMessage) rejoined.send('end', this.endMessage);
    } catch {
      if (this.phase === 'playing') this.engine?.forfeit(side, 'disconnect');
    }
  }

  onDispose() {
    this.countdown?.clear();
  }

  private sendWelcome(client: Client, side: Side) {
    const welcome: RoomWelcomeMessage = { side, roomId: this.roomId, isPrivate: this.isPrivate };
    client.send('welcome', welcome);
  }

  private broadcastLobby() {
    const message: RoomLobbyMessage = {
      phase: this.phase,
      roomId: this.roomId,
      isPrivate: this.isPrivate,
      players: [...this.seats.values()].map(({ sessionId: _sessionId, ...player }) => player),
      countdownMs: this.phase === 'countdown' ? Math.max(0, this.countdownEndsAt - Date.now()) : 0
    };
    this.broadcast('lobby', message);
  }

  private beginCountdown() {
    this.phase = 'countdown';
    this.countdownEndsAt = Date.now() + COUNTDOWN_MS;
    void this.lock();
    this.countdown = this.clock.setTimeout(() => this.startMatch(), COUNTDOWN_MS);
  }

  private cancelCountdown() {
    this.countdown?.clear();
    this.countdown = null;
    this.phase = 'waiting';
    void this.unlock();
  }

  private startMatch() {
    this.countdown = null;
    if (this.seats.size < 2) {
      this.cancelCountdown();
      this.broadcastLobby();
      return;
    }
    this.engine = new MatchEngine();
    this.phase = 'playing';
    this.broadcastLobby();
    this.broadcast('s', encodeSnapshot(this.engine.state, []));
    this.setSimulationInterval((deltaMs) => this.tick(deltaMs), GAME_RULES.tickMs);
  }

  private tick(deltaMs: number) {
    const engine = this.engine;
    if (!engine || this.phase !== 'playing') return;
    engine.update(deltaMs);
    this.pendingEvents.push(...engine.drainEvents());
    this.sinceSnapshot += deltaMs;
    if (this.sinceSnapshot >= SNAPSHOT_MS || engine.ended) {
      this.sinceSnapshot = 0;
      this.broadcast('s', encodeSnapshot(engine.state, this.pendingEvents));
      this.pendingEvents = [];
    }
    if (engine.ended) this.finishMatch(engine);
  }

  private handleCommand(client: Client<ClientData, CurrentUser>, payload: unknown) {
    const data = client.userData;
    if (!data || !this.engine || this.phase !== 'playing') return;
    const t = Date.now();
    if (t - data.commandWindowStart >= 1000) {
      data.commandWindowStart = t;
      data.commandCount = 0;
    }
    if (++data.commandCount > COMMANDS_PER_SECOND) return;

    const command = parseCommand(payload);
    if (!command) {
      client.send('notice', { ok: false, error: 'Invalid command.' });
      return;
    }
    const result = this.engine.command(data.side, command);
    if (!result.ok || result.message) client.send('notice', result);
    // Surrender and peace are resolved immediately so the result isn't delayed a tick.
    if (this.engine.ended) this.tick(0);
  }

  private finishMatch(engine: MatchEngine) {
    this.phase = 'ended';
    this.setSimulationInterval();
    const result = engine.state.result!;
    let matchId: string | null = null;
    let ratings: RoomEndMessage['ratings'] = [];
    try {
      const seats = [...this.seats.values()];
      const recorded = recordPvpMatch({
        seats: seats.map((seat) => ({ side: seat.side, userId: seat.userId, displayName: seat.displayName, avatar: seat.avatar })),
        rated: !this.isPrivate,
        winner: result.winner,
        reason: result.reason,
        durationMs: result.timeMs,
        stats: { blue: engine.state.players.blue.stats, red: engine.state.players.red.stats }
      });
      matchId = recorded.id;
      ratings = recorded.ratings;
      for (const change of ratings) {
        const seat = this.seats.get(change.side);
        if (seat) seat.rating = change.after;
      }
    } catch (error) {
      console.error('[arena] failed to record match', error);
    }
    this.endMessage = { result, matchId, ratings };
    this.broadcast('end', this.endMessage);
    this.broadcastLobby();
    console.log(
      `[arena] room ${this.roomId} ended: ${result.winner ?? 'draw'} by ${result.reason} after ${Math.round(result.timeMs / 1000)}s` +
        ` (${[...this.seats.values()].map((s) => `${s.side}=${s.username}`).join(', ')})`
    );
    this.clock.setTimeout(() => this.disconnect(), ENDED_ROOM_TTL_MS);
  }
}
