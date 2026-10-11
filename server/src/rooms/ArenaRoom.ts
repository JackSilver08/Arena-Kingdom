import {
  Room,
  ServerError,
  matchMaker,
  type AuthContext,
  type Client,
  type Delayed,
} from "colyseus";
import {
  GAME_RULES,
  MatchEngine,
  encodeSnapshot,
  parseCommand,
  type GameEvent,
  type RoomEndMessage,
  type RoomLobbyMessage,
  type RoomPhase,
  type RoomPlayer,
  type RoomWelcomeMessage,
  type Side,
} from "@arena-kingdom/shared";
import { config } from "../config.js";
import { recordPvpMatch } from "../db/matches.js";
import { userForToken } from "../db/sessions.js";
import {
  claimLease,
  limitPrivateCreation,
  moveLease,
  ownsLease,
  rankedAuthority,
  releaseLease,
  releaseRoomLeases,
  requireProtocol,
  RESERVATION_SECONDS,
  type Admission,
} from "../online/admission.js";
import { forgetRankedEntry, forgetRankedRoom } from "../online/ranked.js";

const COUNTDOWN_MS = 3000;
const SNAPSHOT_MS = 100;
const COMMANDS_PER_SECOND = 20;
const ENDED_ROOM_TTL_MS = 10 * 60_000;

interface Seat extends RoomPlayer {
  sessionId: string;
  leaseId: string;
}

interface ClientData {
  side: Side;
  commandWindowStart: number;
  commandCount: number;
}

export class ArenaRoom extends Room<
  object,
  { private: boolean },
  ClientData,
  Admission
> {
  maxClients = 2;
  autoDispose = false;

  private seats = new Map<Side, Seat>();
  private phase: RoomPhase = "waiting";
  private isPrivate = false;
  private engine: MatchEngine | null = null;
  private countdown: Delayed | null = null;
  private countdownEndsAt = 0;
  private sinceSnapshot = 0;
  private pendingEvents: GameEvent[] = [];
  private endMessage: RoomEndMessage | null = null;
  private waitingTimeout: Delayed | null = null;

  onCreate(options: {
    private?: unknown;
    rankedProof?: unknown;
    protocolVersion?: unknown;
  }) {
    requireProtocol(options?.protocolVersion);
    this.isPrivate = options?.private === true;
    if (!this.isPrivate && options?.rankedProof !== rankedAuthority)
      throw new ServerError(403, "Ranked matches must use the server queue.");
    // Both modes are hidden from generic join/joinOrCreate discovery. Private uses invitation IDs.
    void this.setPrivate(true);
    this.setSeatReservationTime(RESERVATION_SECONDS);
    void this.setMetadata({ private: this.isPrivate });
    this.onMessage("cmd", (client, payload) =>
      this.handleCommand(client, payload),
    );
    this.waitingTimeout = this.clock.setTimeout(
      () => {
        void this.disconnect();
      },
      this.isPrivate ? 120_000 : RESERVATION_SECONDS * 1000,
    );
  }

  /** Runs during HTTP matchmaking, so unauthenticated requests never reserve a seat. */
  static async onAuth(
    token: string,
    options: { token?: unknown; private?: unknown; protocolVersion?: unknown },
    context: AuthContext,
  ) {
    const session = userForToken(
      typeof options?.token === "string" ? options.token : token,
    );
    if (!session) throw new ServerError(401, "Please sign in to play online.");
    requireProtocol(options?.protocolVersion);
    if (options?.private !== true)
      throw new ServerError(403, "Ranked matches must use the server queue.");
    const route = context.req?.url?.match(
      /\/matchmake\/(create|joinById)\/([A-Za-z0-9_-]+)/,
    );
    if (!route)
      throw new ServerError(403, "Use private create or a private room code.");
    if (route[1] === "joinById") {
      const room = await matchMaker.getRoomById(route[2]);
      if (room?.metadata?.private !== true)
        throw new ServerError(403, "Ranked matches must use the server queue.");
    }
    const leaseId = claimLease(
      session.user.id,
      "private-reservation",
      RESERVATION_SECONDS * 1000,
    );
    try {
      if (route[1] === "create") limitPrivateCreation(session.user.id);
    } catch (error) {
      releaseLease(session.user.id, leaseId);
      throw error;
    }
    return { user: session.user, leaseId, ranked: false } satisfies Admission;
  }

  onJoin(
    client: Client<ClientData, Admission>,
    options: { protocolVersion?: unknown },
    admission: Admission,
  ) {
    const { user, leaseId, ranked } = admission;
    try {
      requireProtocol(options.protocolVersion);
      if (
        ranked === this.isPrivate ||
        !ownsLease(
          user.id,
          leaseId,
          ranked ? this.roomId : "private-reservation",
        )
      ) {
        throw new ServerError(
          403,
          "Your seat was not admitted to this match. Use the ranked queue or private code.",
        );
      }
      moveLease(user.id, leaseId, this.roomId);
    } catch (error) {
      releaseLease(user.id, leaseId);
      throw error;
    }
    for (const seat of this.seats.values()) {
      if (seat.userId === user.id)
        throw new ServerError(409, "You are already seated in this match.");
    }
    const side: Side = this.seats.has("blue") ? "red" : "blue";
    this.seats.set(side, {
      side,
      leaseId,
      sessionId: client.sessionId,
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      rating: user.rating,
      connected: true,
    });
    client.userData = { side, commandWindowStart: 0, commandCount: 0 };
    forgetRankedEntry(user.id, leaseId);
    this.sendWelcome(client, side);
    if (
      this.seats.size === 2 &&
      [...this.seats.values()].every((seat) => seat.connected)
    )
      this.beginCountdown();
    this.broadcastLobby();
  }

  async onLeave(client: Client<ClientData, Admission>, consented: boolean) {
    const side = client.userData?.side;
    const seat = side ? this.seats.get(side) : undefined;
    if (!side || !seat || seat.sessionId !== client.sessionId) return;

    if ((this.phase === "waiting" || this.phase === "countdown") && consented) {
      releaseLease(seat.userId, seat.leaseId);
      this.seats.delete(side);
      this.cancelCountdown();
      this.broadcastLobby();
      // A ranked pair cannot replace an invited opponent after cancelling countdown.
      if (!this.isPrivate || !this.seats.size) void this.disconnect();
      return;
    }
    if (this.phase === "ended") return;

    if (consented) {
      this.engine?.forfeit(side, "surrender");
      return;
    }

    seat.connected = false;
    if (this.phase === "countdown" || this.phase === "waiting") this.cancelCountdown();
    this.broadcastLobby();
    try {
      const rejoined = await this.allowReconnection(
        client,
        config.reconnectSeconds,
      );
      seat.sessionId = rejoined.sessionId;
      seat.connected = true;
      rejoined.userData = { side, commandWindowStart: 0, commandCount: 0 };
      this.sendWelcome(rejoined, side);
      if (
        this.phase === "waiting" &&
        this.seats.size === 2 &&
        [...this.seats.values()].every((s) => s.connected)
      )
        this.beginCountdown();
      this.broadcastLobby();
      this.sendSnapshotTo(rejoined, []);
      if (this.endMessage) rejoined.send("end", this.endMessage);
    } catch {
      if (this.phase === "playing") this.engine?.forfeit(side, "disconnect");
      else if (!this.endMessage) {
        releaseLease(seat.userId, seat.leaseId);
        this.seats.delete(side);
        if (!this.isPrivate || !this.seats.size) void this.disconnect();
        else this.broadcastLobby();
      }
    }
  }

  onDispose() {
    this.countdown?.clear();
    this.waitingTimeout?.clear();
    releaseRoomLeases(this.roomId);
    forgetRankedRoom(this.roomId);
    for (const seat of this.seats.values())
      forgetRankedEntry(seat.userId, seat.leaseId);
  }

  private sendWelcome(client: Client, side: Side) {
    const welcome: RoomWelcomeMessage = {
      side,
      roomId: this.roomId,
      isPrivate: this.isPrivate,
    };
    client.send("welcome", welcome);
  }

  private broadcastLobby() {
    const message: RoomLobbyMessage = {
      phase: this.phase,
      roomId: this.roomId,
      isPrivate: this.isPrivate,
      players: [...this.seats.values()].map(
        ({ sessionId: _sessionId, leaseId: _leaseId, ...player }) => player,
      ),
      countdownMs:
        this.phase === "countdown"
          ? Math.max(0, this.countdownEndsAt - Date.now())
          : 0,
    };
    this.broadcast("lobby", message);
  }

  private beginCountdown() {
    this.waitingTimeout?.clear();
    this.phase = "countdown";
    this.countdownEndsAt = Date.now() + COUNTDOWN_MS;
    void this.lock();
    this.countdown = this.clock.setTimeout(
      () => this.startMatch(),
      COUNTDOWN_MS,
    );
  }

  private cancelCountdown() {
    this.countdown?.clear();
    this.countdown = null;
    this.phase = "waiting";
    this.waitingTimeout?.clear();
    this.waitingTimeout = this.clock.setTimeout(
      () => {
        void this.disconnect();
      },
      this.isPrivate ? Math.max(120_000, config.reconnectSeconds * 1000 + 1000)
        : Math.max(RESERVATION_SECONDS * 1000, config.reconnectSeconds * 1000 + 1000),
    );
    void this.unlock();
  }

  private startMatch() {
    this.countdown = null;
    if (
      this.seats.size < 2 ||
      [...this.seats.values()].some((seat) => !seat.connected)
    ) {
      this.cancelCountdown();
      this.broadcastLobby();
      return;
    }
    this.engine = new MatchEngine();
    this.waitingTimeout?.clear();
    this.phase = "playing";
    this.broadcastLobby();
    this.sendSnapshots([]);
    this.setSimulationInterval(
      (deltaMs) => this.tick(deltaMs),
      GAME_RULES.tickMs,
    );
  }

  private tick(deltaMs: number) {
    const engine = this.engine;
    if (!engine || this.phase !== "playing") return;
    engine.update(deltaMs);
    this.pendingEvents.push(...engine.drainEvents());
    this.sinceSnapshot += deltaMs;
    if (this.sinceSnapshot >= SNAPSHOT_MS || engine.ended) {
      this.sinceSnapshot = 0;
      this.sendSnapshots(this.pendingEvents);
      this.pendingEvents = [];
    }
    if (engine.ended) this.finishMatch(engine);
  }

  private sendSnapshots(events: readonly GameEvent[]) {
    const engine = this.engine;
    if (!engine) return;
    for (const client of this.clients) {
      const side = client.userData?.side;
      if (!side) continue;
      client.send(
        "s",
        encodeSnapshot(
          engine.viewForSide(side),
          engine.eventsForSide(side, events),
        ),
      );
    }
  }

  private sendSnapshotTo(
    client: Client<ClientData, Admission>,
    events: readonly GameEvent[],
  ) {
    const engine = this.engine;
    const side = client.userData?.side;
    if (!engine || !side) return;
    client.send(
      "s",
      encodeSnapshot(
        engine.viewForSide(side),
        engine.eventsForSide(side, events),
      ),
    );
  }

  private handleCommand(
    client: Client<ClientData, Admission>,
    payload: unknown,
  ) {
    const data = client.userData;
    if (!data || !this.engine || this.phase !== "playing") return;
    const t = Date.now();
    if (t - data.commandWindowStart >= 1000) {
      data.commandWindowStart = t;
      data.commandCount = 0;
    }
    if (++data.commandCount > COMMANDS_PER_SECOND) return;

    const command = parseCommand(payload);
    if (!command) {
      client.send("notice", { ok: false, error: "Invalid command." });
      return;
    }
    const result = this.engine.command(data.side, command);
    if (!result.ok || result.message) client.send("notice", result);
    // Surrender and peace are resolved immediately so the result isn't delayed a tick.
    if (this.engine.ended) this.tick(0);
  }

  private finishMatch(engine: MatchEngine) {
    this.phase = "ended";
    releaseRoomLeases(this.roomId);
    this.setSimulationInterval();
    const result = engine.state.result!;
    let matchId: string | null = null;
    let ratings: RoomEndMessage["ratings"] = [];
    try {
      const seats = [...this.seats.values()];
      const recorded = recordPvpMatch({
        seats: seats.map((seat) => ({
          side: seat.side,
          userId: seat.userId,
          displayName: seat.displayName,
          avatar: seat.avatar,
        })),
        rated: !this.isPrivate,
        winner: result.winner,
        reason: result.reason,
        durationMs: result.timeMs,
        stats: {
          blue: engine.state.players.blue.stats,
          red: engine.state.players.red.stats,
        },
      });
      matchId = recorded.id;
      ratings = recorded.ratings;
      for (const change of ratings) {
        const seat = this.seats.get(change.side);
        if (seat) seat.rating = change.after;
      }
    } catch (error) {
      console.error("[arena] failed to record match", error);
    }
    this.endMessage = { result, matchId, ratings };
    this.broadcast("end", this.endMessage);
    this.broadcastLobby();
    console.log(
      `[arena] room ${this.roomId} ended: ${result.winner ?? "draw"} by ${result.reason} after ${Math.round(result.timeMs / 1000)}s` +
        ` (${[...this.seats.values()].map((s) => `${s.side}=${s.username}`).join(", ")})`,
    );
    this.clock.setTimeout(() => this.disconnect(), ENDED_ROOM_TTL_MS);
  }
}
