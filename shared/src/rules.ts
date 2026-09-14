import type { ArmyFraction, BuildableType, BuildingType, Side, UnitType } from './types.js';

export const GAME_VERSION = '0.3.0';

export const GAME_RULES = {
  /** Fixed simulation step. */
  tickMs: 50,
  /** A match that reaches this length is decided by remaining castle health. */
  maxMatchMs: 20 * 60_000,
  map: {
    /** The whole scene, ocean included. */
    width: 1920,
    height: 1080,
    /** Walkable land. Blue rules the top half, Red the bottom half. */
    island: { x: 610, y: 175, width: 700, height: 740 },
    midlineY: 545,
    /** Half-height of the no-build strip around the midline. */
    neutralZone: 26
  },
  economy: {
    startingGold: 100,
    castleIncome: 4,
    villageIncome: 5,
    incomeIntervalMs: 5000,
    maxQueuePerBarracks: 5
  },
  limits: {
    maxUnitsPerSide: 40,
    maxBuildingsPerSide: 30
  },
  peace: {
    responseWindowMs: 15_000,
    cooldownMs: 30_000
  }
} as const;

export interface AttackStats {
  damage: number;
  /** Reach beyond both bodies' edges. */
  range: number;
  cooldownMs: number;
}

export interface BuildingStats {
  label: string;
  /** Emoji used in text-only contexts. */
  icon: string;
  cost: number;
  hp: number;
  /** Circles use `halfWidth` as their radius; fences are axis-aligned rectangles. */
  shape: 'circle' | 'rect';
  halfWidth: number;
  halfHeight: number;
  attack?: AttackStats;
  description: string;
}

export const BUILDING_STATS: Record<BuildingType, BuildingStats> = {
  castle: {
    label: 'Castle',
    icon: '🏰',
    cost: 0,
    hp: 1500,
    shape: 'circle',
    halfWidth: 46,
    halfHeight: 46,
    attack: { damage: 9, range: 80, cooldownMs: 1000 },
    description: 'Your seat of power. Fires arrows at nearby attackers. If it falls, you lose.'
  },
  village: {
    label: 'Village',
    icon: '🏘️',
    cost: 75,
    hp: 300,
    shape: 'circle',
    halfWidth: 26,
    halfHeight: 26,
    description: `+${GAME_RULES.economy.villageIncome} gold every ${GAME_RULES.economy.incomeIntervalMs / 1000}s.`
  },
  barracks: {
    label: 'Barracks',
    icon: '⚔️',
    cost: 120,
    hp: 500,
    shape: 'circle',
    halfWidth: 28,
    halfHeight: 28,
    description: 'Trains troops. More barracks train in parallel.'
  },
  fence: {
    label: 'Fence',
    icon: '🪵',
    cost: 30,
    hp: 450,
    shape: 'rect',
    halfWidth: 64,
    halfHeight: 11,
    description: 'Wooden palisade. Enemy troops must go around or break through; yours pass freely.'
  },
  tower: {
    label: 'Tower',
    icon: '🗼',
    cost: 130,
    hp: 700,
    shape: 'circle',
    halfWidth: 20,
    halfHeight: 20,
    attack: { damage: 18, range: 100, cooldownMs: 850 },
    description: 'Shoots enemy troops in range. Cannot move.'
  }
};

export interface UnitStats {
  label: string;
  cost: number;
  trainMs: number;
  hp: number;
  radius: number;
  speed: number;
  aggroRange: number;
  attack: AttackStats;
}

export const UNIT_STATS: Record<UnitType, UnitStats> = {
  soldier: {
    label: 'Troop',
    cost: 20,
    trainMs: 2500,
    hp: 100,
    radius: 10,
    speed: 52,
    aggroRange: 120,
    attack: { damage: 12, range: 14, cooldownMs: 800 }
  }
};

export interface Placement {
  side: Side;
  type: BuildingType;
  x: number;
  y: number;
}

/** Starting layout for the blue (top) side. Red is mirrored across the midline. */
const BLUE_START: { buildings: Omit<Placement, 'side'>[]; units: { x: number; y: number }[] } = {
  buildings: [
    { type: 'castle', x: 960, y: 238 },
    { type: 'village', x: 730, y: 290 },
    { type: 'village', x: 830, y: 395 },
    { type: 'village', x: 1140, y: 318 },
    { type: 'barracks', x: 1030, y: 385 }
  ],
  units: [
    { x: 1076, y: 402 },
    { x: 1096, y: 424 },
    { x: 1116, y: 446 }
  ]
};

export function mirrorY(y: number): number {
  return GAME_RULES.map.midlineY * 2 - y;
}

export function startingLayout(side: Side) {
  const flip = (y: number) => (side === 'blue' ? y : mirrorY(y));
  return {
    buildings: BLUE_START.buildings.map((b) => ({ ...b, side, y: flip(b.y) })),
    units: BLUE_START.units.map((u) => ({ x: u.x, y: flip(u.y) }))
  };
}

/** Vertical direction from a side's castle towards the enemy. */
export function forwardDir(side: Side): 1 | -1 {
  return side === 'blue' ? 1 : -1;
}

/** Area a side may build in; padding shrinks it on every edge. */
export function territoryBounds(side: Side, padX = 0, padY = padX) {
  const { island, midlineY, neutralZone } = GAME_RULES.map;
  const minX = island.x + padX;
  const maxX = island.x + island.width - padX;
  if (side === 'blue') {
    return { minX, maxX, minY: island.y + padY, maxY: midlineY - neutralZone - padY };
  }
  return { minX, maxX, minY: midlineY + neutralZone + padY, maxY: island.y + island.height - padY };
}

export function clampToIsland(x: number, y: number, padding = 0) {
  const { island } = GAME_RULES.map;
  return {
    x: Math.min(island.x + island.width - padding, Math.max(island.x + padding, x)),
    y: Math.min(island.y + island.height - padding, Math.max(island.y + padding, y))
  };
}

type Located = { x: number; y: number; type: BuildingType };

/** Distance from a point to a building's edge (0 when inside). */
export function distanceToBuilding(building: Located, x: number, y: number) {
  const stats = BUILDING_STATS[building.type];
  if (stats.shape === 'circle') return Math.max(0, Math.hypot(x - building.x, y - building.y) - stats.halfWidth);
  const dx = Math.max(Math.abs(x - building.x) - stats.halfWidth, 0);
  const dy = Math.max(Math.abs(y - building.y) - stats.halfHeight, 0);
  return Math.hypot(dx, dy);
}

/** The point a unit should walk towards to reach a building. */
export function approachPoint(building: Located, x: number, y: number) {
  const stats = BUILDING_STATS[building.type];
  if (stats.shape === 'circle') return { x: building.x, y: building.y };
  return {
    x: Math.min(building.x + stats.halfWidth, Math.max(building.x - stats.halfWidth, x)),
    y: Math.min(building.y + stats.halfHeight, Math.max(building.y - stats.halfHeight, y))
  };
}

export type PlacementCheck = { ok: true } | { ok: false; reason: string };

const BUILDING_GAP = 12;
const EDGE_PADDING = 8;
const FENCE_SNAP_DISTANCE = 34;

export function canPlaceBuilding(
  buildings: readonly (Located & { side?: Side })[],
  side: Side,
  type: BuildableType,
  x: number,
  y: number
): PlacementCheck {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, reason: 'Invalid position.' };
  const stats = BUILDING_STATS[type];
  const bounds = territoryBounds(side, stats.halfWidth + EDGE_PADDING, stats.halfHeight + EDGE_PADDING);
  if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY) {
    return { ok: false, reason: `You can only build inside the ${side === 'blue' ? 'BLUE' : 'RED'} territory.` };
  }
  for (const other of buildings) {
    const otherStats = BUILDING_STATS[other.type];
    // Fence segments may touch so they form a continuous wall.
    const gap = type === 'fence' && other.type === 'fence' ? 0 : BUILDING_GAP;
    if (
      Math.abs(other.x - x) < stats.halfWidth + otherStats.halfWidth + gap &&
      Math.abs(other.y - y) < stats.halfHeight + otherStats.halfHeight + gap
    ) {
      return { ok: false, reason: 'Too close to another building.' };
    }
  }
  return { ok: true };
}

/** Snaps a fence next to an existing fence of the same side, so walls line up. */
export function snapPlacement(
  buildings: readonly (Located & { side: Side })[],
  side: Side,
  type: BuildableType,
  x: number,
  y: number
) {
  if (type !== 'fence') return { x, y };
  const width = BUILDING_STATS.fence.halfWidth * 2;
  let best = { x, y };
  let bestDistance = FENCE_SNAP_DISTANCE;
  for (const fence of buildings) {
    if (fence.type !== 'fence' || fence.side !== side) continue;
    for (const candidate of [
      { x: fence.x - width, y: fence.y },
      { x: fence.x + width, y: fence.y }
    ]) {
      const d = Math.hypot(candidate.x - x, candidate.y - y);
      if (d < bestDistance && canPlaceBuilding(buildings, side, 'fence', candidate.x, candidate.y).ok) {
        best = candidate;
        bestDistance = d;
      }
    }
  }
  return best;
}

export function incomeFor(villages: number): number {
  return GAME_RULES.economy.castleIncome + villages * GAME_RULES.economy.villageIncome;
}

export function fractionOf(fraction: ArmyFraction): number {
  return fraction === 'all' ? 1 : fraction === 'one-third' ? 1 / 3 : 2 / 3;
}
