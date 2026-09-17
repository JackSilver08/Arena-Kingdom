export type Side = 'blue' | 'red';
export type BuildingType = 'castle' | 'village' | 'barracks' | 'fence' | 'tower';
export type BuildableType = Exclude<BuildingType, 'castle'>;
export type UnitType = 'soldier';
export type ArmyFraction = 'all' | 'one-third' | 'two-thirds';
export type FormationType = 'line' | 'column' | 'wedge' | 'square';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type MatchMode = 'ai' | 'pvp';
export type EndReason = 'castle' | 'surrender' | 'peace' | 'timeout' | 'disconnect';

export const SIDES: readonly Side[] = ['blue', 'red'];
export const BUILDABLE_TYPES: readonly BuildableType[] = ['village', 'barracks', 'fence', 'tower'];
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];
export const ARMY_FRACTIONS: readonly ArmyFraction[] = ['all', 'one-third', 'two-thirds'];
export const FORMATIONS: readonly FormationType[] = ['line', 'column', 'wedge', 'square'];

export function opponentOf(side: Side): Side {
  return side === 'blue' ? 'red' : 'blue';
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface UnitView {
  id: number;
  side: Side;
  type: UnitType;
  /** Present in clients that render formation metadata; live wire snapshots may omit it. */
  formation?: FormationType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  moving: boolean;
  attacking: boolean;
}

export interface BuildingView {
  id: number;
  side: Side;
  type: BuildingType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** Soldiers waiting in the training queue (barracks only). */
  queue: number;
  /** Progress of the soldier currently in training, 0..1. */
  trainProgress: number;
}

export interface PlayerStats {
  goldEarned: number;
  goldSpent: number;
  unitsTrained: number;
  unitsLost: number;
  kills: number;
  buildingsBuilt: number;
  buildingsLost: number;
  buildingsDestroyed: number;
  damageDealt: number;
  peakArmy: number;
}

export const STAT_KEYS: readonly (keyof PlayerStats)[] = [
  'goldEarned',
  'goldSpent',
  'unitsTrained',
  'unitsLost',
  'kills',
  'buildingsBuilt',
  'buildingsLost',
  'buildingsDestroyed',
  'damageDealt',
  'peakArmy'
];

export function emptyStats(): PlayerStats {
  return {
    goldEarned: 0,
    goldSpent: 0,
    unitsTrained: 0,
    unitsLost: 0,
    kills: 0,
    buildingsBuilt: 0,
    buildingsLost: 0,
    kills: 0,
    buildingsBuilt: 0,
    buildingsLost: 0,
    buildingsDestroyed: 0,
    damageDealt: 0,
    peakArmy: 0
  };
}

export interface PlayerView {
  side: Side;
  gold: number;
  /** Gold received every income interval. */
  income: number;
  stats: PlayerStats;
}

export interface PeaceView {
  proposedBy: Side;
  expiresInMs: number;
}

export interface MatchResult {
  /** `null` means draw. */
  winner: Side | null;
  reason: EndReason;
  timeMs: number;
}

/** Everything a renderer needs to draw a match. Shared by local and online sessions. */
export interface MatchView {
  timeMs: number;
  nextIncomeInMs: number;
  players: Record<Side, PlayerView>;
  units: UnitView[];
  buildings: BuildingView[];
  peace: PeaceView | null;
  result: MatchResult | null;
}

export type Command =
  | { type: 'build'; building: BuildableType; x: number; y: number }
  | { type: 'train'; barracksId?: number; count?: number }
  /** With `targetId` the troops attack that enemy unit or building until it falls. */
  | { type: 'move'; unitIds: number[]; x: number; y: number; attack: boolean; targetId?: number; formation?: FormationType }
  | { type: 'army'; fraction: ArmyFraction; x: number; y: number; targetId?: number; formation?: FormationType }
  | { type: 'stop'; unitIds: number[] }
  | { type: 'proposePeace' }
  | { type: 'respondPeace'; accept: boolean }
  | { type: 'surrender' };

export type CommandResult = { ok: true; message?: string } | { ok: false; error: string };

export type GameEvent =
  | { type: 'shot'; side: Side; fromX: number; fromY: number; toX: number; toY: number }
  | { type: 'hit'; x: number; y: number }
  | { type: 'unitDied'; side: Side; x: number; y: number }
  | { type: 'unitTrained'; side: Side; x: number; y: number }
  | { type: 'buildingPlaced'; side: Side; building: BuildingType; x: number; y: number }
  | { type: 'buildingDestroyed'; side: Side; building: BuildingType; x: number; y: number }
  | { type: 'peaceProposed'; by: Side }
  | { type: 'peaceDeclined'; by: Side }
  | { type: 'peaceExpired' }
  | { type: 'matchEnded'; result: MatchResult };
