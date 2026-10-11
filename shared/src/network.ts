import {
  STAT_KEYS,
  emptyStats,
  FORMATIONS,
  type BuildingType,
  type EndReason,
  type GameEvent,
  type MatchResult,
  type MatchView,
  type PlayerView,
  type Side,
  type UnitType
} from './types.js';

/** Compact wire format for match state; flat number arrays keep messages small. */
export const SNAPSHOT_PROTOCOL_VERSION = 6;

export interface EncodedSnapshot {
  /** Wire format version. Omitted on legacy snapshots. */
  v?: number;
  t: number;
  n: number;
  p: number[];
  u: number[];
  b: number[];
  pc: [number, number] | null;
  r: [number, number, number] | null;
  e: GameEvent[];
}

const SIDE_CODES: Side[] = ['blue', 'red'];
const UNIT_CODES: UnitType[] = ['soldier', 'militia', 'archer', 'knight', 'scout', 'royal_guard', 'cannon'];
// Append new types at the end so existing codes stay stable.
const BUILDING_CODES: BuildingType[] = ['castle', 'village', 'barracks', 'tower', 'fence'];
const REASON_CODES: EndReason[] = ['castle', 'surrender', 'peace', 'timeout', 'disconnect'];
const UNIT_FIELDS = 6;
const BUILDING_FIELDS = 9;

const round = (n: number) => Math.round(n);

export function encodeSnapshot(view: MatchView, events: GameEvent[]): EncodedSnapshot {
  const p: number[] = [];
  for (const side of SIDE_CODES) {
    const player = view.players[side];
    const disclosed = player.privateInfoVisible !== false;
    p.push(disclosed ? 1 : 0, disclosed ? player.gold : 0, disclosed ? player.income : 0,
      ...STAT_KEYS.map((key) => disclosed ? round(player.stats[key]) : 0));
  }
  const u: number[] = [];
  for (const unit of view.units) {
    const formation = unit.formation === undefined ? -1 : FORMATIONS.indexOf(unit.formation);
    const flags =
      SIDE_CODES.indexOf(unit.side) |
      (unit.moving ? 2 : 0) |
      (unit.attacking ? 4 : 0) |
      (UNIT_CODES.indexOf(unit.type) << 3) |
      (unit.rearguard ? 64 : 0) |
      (unit.retreating ? 128 : 0) |
      (formation >= 0 ? 1024 | (formation << 8) : 0);
    u.push(unit.id, flags, round(unit.x), round(unit.y), Math.max(0, round(unit.hp)), unit.maxHp);
  }
  const b: number[] = [];
  for (const building of view.buildings) {
    const rotationBits = building.type === 'fence' && Number.isInteger(building.rotation)
      ? ((building.rotation as number) & 7) << 4
      : 0;
    const flags = SIDE_CODES.indexOf(building.side) | (BUILDING_CODES.indexOf(building.type) << 1) | rotationBits;
    b.push(
      building.id,
      flags,
      round(building.x),
      round(building.y),
      Math.max(0, round(building.hp)),
      building.maxHp,
      building.queue,
      round(building.trainProgress * 100),
      building.trainType === null ? -1 : UNIT_CODES.indexOf(building.trainType)
    );
  }
  return {
    v: SNAPSHOT_PROTOCOL_VERSION,
    t: round(view.timeMs),
    n: round(view.nextIncomeInMs),
    p,
    u,
    b,
    pc: view.peace ? [SIDE_CODES.indexOf(view.peace.proposedBy), round(view.peace.expiresInMs)] : null,
    r: view.result ? encodeResult(view.result) : null,
    e: events
  };
}

function encodeResult(result: MatchResult): [number, number, number] {
  return [result.winner ? SIDE_CODES.indexOf(result.winner) : -1, REASON_CODES.indexOf(result.reason), round(result.timeMs)];
}

export function decodeSnapshot(snap: EncodedSnapshot): { view: MatchView; events: GameEvent[] } {
  if (snap.v !== SNAPSHOT_PROTOCOL_VERSION) {
    throw new Error(`Unsupported snapshot protocol version ${snap.v ?? 'missing'}; expected ${SNAPSHOT_PROTOCOL_VERSION}. Update the client and server together.`);
  }
  const statCount = STAT_KEYS.length;
  const players = {} as Record<Side, PlayerView>;
  SIDE_CODES.forEach((side, index) => {
    const offset = index * (3 + statCount);
    const disclosed = snap.p[offset] === 1;
    const stats = emptyStats();
    STAT_KEYS.forEach((key, i) => {
      stats[key] = disclosed ? snap.p[offset + 3 + i] ?? 0 : 0;
    });
    players[side] = { side, privateInfoVisible: disclosed,
      gold: disclosed ? snap.p[offset + 1] ?? 0 : 0, income: disclosed ? snap.p[offset + 2] ?? 0 : 0, stats };
  });

  const units: MatchView['units'] = [];
  for (let i = 0; i + UNIT_FIELDS <= snap.u.length; i += UNIT_FIELDS) {
    const flags = snap.u[i + 1];
    units.push({
      id: snap.u[i],
      side: SIDE_CODES[flags & 1],
      moving: (flags & 2) !== 0,
      attacking: (flags & 4) !== 0,
      type: UNIT_CODES[(flags >> 3) & 0x7] ?? 'soldier',
      formation: (flags & 1024) !== 0 ? FORMATIONS[(flags >> 8) & 0x3] : undefined,
      rearguard: (flags & 64) !== 0,
      retreating: (flags & 128) !== 0,
      x: snap.u[i + 2],
      y: snap.u[i + 3],
      hp: snap.u[i + 4],
      maxHp: snap.u[i + 5]
    });
  }

  const buildings: MatchView['buildings'] = [];
  const buildingFields = BUILDING_FIELDS;
  for (let i = 0; i + buildingFields <= snap.b.length; i += buildingFields) {
    const flags = snap.b[i + 1];
    const type = BUILDING_CODES[(flags >> 1) & 0x7] ?? 'village';
    buildings.push({
      id: snap.b[i],
      side: SIDE_CODES[flags & 1],
      type,
      ...(type === 'fence' ? { rotation: (flags >> 4) & 0x7 } : {}),
      x: snap.b[i + 2],
      y: snap.b[i + 3],
      hp: snap.b[i + 4],
      maxHp: snap.b[i + 5],
      queue: snap.b[i + 6],
      trainProgress: snap.b[i + 7] / 100,
      trainType: snap.b[i + 8] >= 0 ? UNIT_CODES[snap.b[i + 8]] ?? 'soldier' : null
    });
  }

  return {
    view: {
      timeMs: snap.t,
      nextIncomeInMs: snap.n,
      players,
      units,
      buildings,
      peace: snap.pc ? { proposedBy: SIDE_CODES[snap.pc[0]], expiresInMs: snap.pc[1] } : null,
      result: snap.r
        ? { winner: snap.r[0] < 0 ? null : SIDE_CODES[snap.r[0]], reason: REASON_CODES[snap.r[1]] ?? 'castle', timeMs: snap.r[2] }
        : null
    },
    events: snap.e ?? []
  };
}

/** Seat information broadcast by an online room. */
export interface RoomPlayer {
  side: Side;
  userId: number;
  username: string;
  displayName: string;
  avatar: string;
  rating: number;
  connected: boolean;
}

export type RoomPhase = 'waiting' | 'countdown' | 'playing' | 'ended';

export interface RoomLobbyMessage {
  phase: RoomPhase;
  roomId: string;
  isPrivate: boolean;
  players: RoomPlayer[];
  countdownMs: number;
}

export interface RoomWelcomeMessage {
  side: Side;
  roomId: string;
  isPrivate: boolean;
}

export interface RatingChange {
  userId: number;
  side: Side;
  before: number;
  after: number;
}

export interface RoomEndMessage {
  result: MatchResult;
  matchId: string | null;
  ratings: RatingChange[];
}
