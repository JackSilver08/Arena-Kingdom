import { clampToIsland } from './island.js';
import { NavGrid } from './navigation.js';
import { FORMATION_STATS, FORMATION_TYPES, formationOffsets } from './formations.js';
import {
  BUILDING_STATS,
  GAME_RULES,
  UNIT_STATS,
  approachPoint,
  armySupplyCapacity,
  armyUpkeep,
  canPlaceBuilding,
  distanceToBuilding,
  forwardDir,
  fractionOf,
  incomeFor,
  startingLayout
} from './rules.js';
import {
  ARMY_FRACTIONS,
  BUILDABLE_TYPES,
  SIDES,
  emptyStats,
  opponentOf,
  type ArmyFraction,
  type BuildableType,
  type BuildingType,
  type BuildingView,
  type Command,
  type CommandResult,
  type EndReason,
  type FormationType,
  type GameEvent,
  type MatchView,
  type PeaceView,
  type PlayerView,
  type Side,
  type UnitType,
  type UnitView,
  type Vec2
} from './types.js';

type Order =
  | { kind: 'idle' }
  | { kind: 'move'; x: number; y: number; attack: boolean }
  | { kind: 'attack'; targetId: number };

export interface UnitState extends UnitView {
  order: Order;
  targetId: number | null;
  cooldownMs: number;
  lastAttackMs: number;
  prevX: number;
  prevY: number;
  path: Vec2[] | null;
  pathGoal: Vec2 | null;
  pathVersion: number;
  pathAt: number;
  /** Enemy fence this unit is breaking because its route is walled off. */
  blockerId: number | null;
  /** What the blocker stands in front of: a target id, or -1 for a move destination. */
  blockedFor: number;
  blockedUntil: number;
  /** Tactical Fall Back assignment. */
  fallbackRole?: 'retreat' | 'rearguard';
  /** End of the temporary retreat speed buff. */
  fallbackUntilMs?: number;
  /** Shared group marker used by rolling retreat. */
  fallbackGroupId?: number;
  /** Defensive destination selected for this fall back group. */
  fallbackGoal?: Vec2;
}

export interface BuildingState extends BuildingView {
  cooldownMs: number;
  trainMs: number;
}

export interface MatchState extends MatchView {
  units: UnitState[];
  buildings: BuildingState[];
  players: Record<Side, PlayerView & { peaceCooldownUntil: number }>;
  peace: PeaceView | null;
  nextId: number;
}

type Entity = UnitState | BuildingState;

const MAX_UNIT_IDS_PER_COMMAND = 200;
let nextFallbackGroupId = 1;
const ATTACK_ANIMATION_MS = 350;
const LEASH_MULTIPLIER = 1.6;
const ARRIVE_DISTANCE = 5;
const PATHS_PER_TICK = 24;
const PATH_REFRESH_MS = 2000;
const BLOCKED_RETRY_MS = 1500;

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

function isBuilding(entity: Entity): entity is BuildingState {
  return Object.prototype.hasOwnProperty.call(BUILDING_STATS, entity.type);
}

/** Validates untrusted input (e.g. a network message) into a Command. */
export function parseCommand(input: unknown): Command | null {
  if (!input || typeof input !== 'object') return null;
  const c = input as Record<string, unknown>;
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  const ids = (v: unknown) =>
    Array.isArray(v) && v.length <= MAX_UNIT_IDS_PER_COMMAND && v.every((id) => Number.isInteger(id));
  const optionalId = (v: unknown) => v === undefined || Number.isInteger(v);
  const optionalFormation = (v: unknown) => v === undefined || FORMATION_TYPES.includes(v as FormationType);
  switch (c.type) {
    case 'build':
      return BUILDABLE_TYPES.includes(c.building as BuildableType) && num(c.x) && num(c.y)
        ? { type: 'build', building: c.building as BuildableType, x: c.x as number, y: c.y as number }
        : null;
    case 'train': {
      if (!optionalId(c.barracksId) || !optionalId(c.count)) return null;
      const unitType = c.unitType === undefined ? 'soldier' : c.unitType;
      if (!['soldier', 'archer', 'knight'].includes(unitType as string)) return null;
      return {
        type: 'train',
        barracksId: c.barracksId as number | undefined,
        count: c.count as number | undefined,
        unitType: unitType as UnitType
      };
    }
    case 'move':
      return ids(c.unitIds) && num(c.x) && num(c.y) && optionalId(c.targetId) && optionalFormation(c.formation)
        ? {
            type: 'move',
            unitIds: c.unitIds as number[],
            x: c.x as number,
            y: c.y as number,
            attack: c.attack !== false,
            targetId: c.targetId as number | undefined,
            formation: c.formation as FormationType | undefined
          }
        : null;
    case 'army':
      return ARMY_FRACTIONS.includes(c.fraction as ArmyFraction) && num(c.x) && num(c.y) && optionalId(c.targetId) && optionalFormation(c.formation)
        ? {
            type: 'army',
            fraction: c.fraction as ArmyFraction,
            x: c.x as number,
            y: c.y as number,
            targetId: c.targetId as number | undefined,
            formation: c.formation as FormationType | undefined
          }
        : null;
    case 'stop':
      return ids(c.unitIds) ? { type: 'stop', unitIds: c.unitIds as number[] } : null;
    case 'fallback':
      return c.unitIds === undefined || ids(c.unitIds)
        ? { type: 'fallback', unitIds: c.unitIds as number[] | undefined }
        : null;
    case 'proposePeace':
      return { type: 'proposePeace' };
    case 'respondPeace':
      return typeof c.accept === 'boolean' ? { type: 'respondPeace', accept: c.accept } : null;
    case 'surrender':
      return { type: 'surrender' };
    default:
      return null;
  }
}

export class MatchEngine {
  readonly state: MatchState;
  private events: GameEvent[] = [];
  private accumulator = 0;
  private readonly nav = new NavGrid();
  private navDirty = true;
  private pathBudget = PATHS_PER_TICK;

  constructor() {
    this.state = {
      timeMs: 0,
      nextIncomeInMs: GAME_RULES.economy.incomeIntervalMs,
      players: {
        blue: this.createPlayer('blue'),
        red: this.createPlayer('red')
      },
      units: [],
      buildings: [],
      peace: null,
      result: null,
      nextId: 1
    };
    for (const side of SIDES) {
      const layout = startingLayout(side);
      for (const b of layout.buildings) this.spawnBuilding(side, b.type, b.x, b.y);
      for (const u of layout.units) this.spawnUnit(side, 'soldier', u.x, u.y);
    }
    this.refreshIncome();
  }

  get ended() {
    return this.state.result !== null;
  }

  /** Advances the simulation by real elapsed time using fixed steps. */
  update(deltaMs: number) {
    if (this.ended) return;
    this.accumulator += Math.min(Math.max(deltaMs, 0), 250);
    while (this.accumulator >= GAME_RULES.tickMs && !this.ended) {
      this.accumulator -= GAME_RULES.tickMs;
      this.tick(GAME_RULES.tickMs);
    }
  }

  drainEvents(): GameEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  command(side: Side, cmd: Command): CommandResult {
    if (this.ended) return { ok: false, error: 'The match is over.' };
    switch (cmd.type) {
      case 'build':
        return this.build(side, cmd.building, cmd.x, cmd.y);
      case 'train':
        return this.train(side, cmd.barracksId, cmd.count ?? 1, cmd.unitType ?? 'soldier');
      case 'move':
        return this.moveUnits(side, cmd.unitIds, cmd.x, cmd.y, cmd.attack, cmd.targetId, cmd.formation);
      case 'army':
        return this.commandArmy(side, cmd.fraction, cmd.x, cmd.y, cmd.targetId, cmd.formation);
      case 'stop':
        return this.stopUnits(side, cmd.unitIds);
      case 'fallback':
        return this.fallback(side, cmd.unitIds);
      case 'proposePeace':
        return this.proposePeace(side);
      case 'respondPeace':
        return this.respondPeace(side, cmd.accept);
      case 'surrender':
        this.finish(opponentOf(side), 'surrender');
        return { ok: true };
    }
  }

  /** Ends the match in favour of the opponent (e.g. the player disconnected). */
  forfeit(side: Side, reason: Extract<EndReason, 'surrender' | 'disconnect'>) {
    if (!this.ended) this.finish(opponentOf(side), reason);
  }

  armyOf(side: Side) {
    return this.state.units.filter((u) => u.side === side);
  }

  buildingsOf(side: Side, type?: BuildingType) {
    return this.state.buildings.filter((b) => b.side === side && (!type || b.type === type));
  }

  castleOf(side: Side) {
    return this.state.buildings.find((b) => b.side === side && b.type === 'castle');
  }

  // ---------------------------------------------------------------- commands

  private build(side: Side, type: BuildableType, rawX: number, rawY: number): CommandResult {
    const stats = BUILDING_STATS[type];
    const player = this.state.players[side];
    const x = Math.round(rawX);
    const y = Math.round(rawY);
    if (player.gold < stats.cost) return { ok: false, error: `Need ${stats.cost} gold to build a ${stats.label}.` };
    if (this.buildingsOf(side).length >= GAME_RULES.limits.maxBuildingsPerSide) {
      return { ok: false, error: 'Building limit reached.' };
    }
    const check = canPlaceBuilding(this.state.buildings, side, type, x, y);
    if (!check.ok) return { ok: false, error: check.reason };
    player.gold -= stats.cost;
    player.stats.goldSpent += stats.cost;
    player.stats.buildingsBuilt += 1;
    this.spawnBuilding(side, type, x, y);
    if (type === 'fence') this.navDirty = true;
    this.events.push({ type: 'buildingPlaced', side, building: type, x, y });
    this.refreshIncome();
    return { ok: true, message: `${stats.label} constructed.` };
  }

  private train(side: Side, barracksId: number | undefined, requested: number, unitType: UnitType): CommandResult {
    if (!['soldier', 'archer', 'knight'].includes(unitType)) return { ok: false, error: 'That unit cannot be trained here.' };
    const count = Math.min(Math.max(requested, 1), GAME_RULES.economy.maxQueuePerBarracks);
    const player = this.state.players[side];
    const trainStats = UNIT_STATS[unitType];
    const barracks = this.buildingsOf(side, 'barracks');
    if (!barracks.length) return { ok: false, error: 'Build a Barracks first.' };
    let pool = barracks;
    if (barracksId !== undefined) {
      pool = barracks.filter((b) => b.id === barracksId);
      if (!pool.length) return { ok: false, error: 'That barracks is not yours.' };
    }
    let queued = 0;
    let error = '';
    for (let i = 0; i < count; i++) {
      const pending = barracks.reduce((sum, b) => sum + b.queue, 0);
      if (this.armyOf(side).length + pending >= GAME_RULES.limits.maxUnitsPerSide) {
        error = `Army limit (${GAME_RULES.limits.maxUnitsPerSide}) reached.`;
        break;
      }
      if (player.gold < trainStats.cost) {
        error = `Need ${trainStats.cost} gold to recruit a ${trainStats.label}.`;
        break;
      }
      const target = pool
        .filter((b) => b.queue < GAME_RULES.economy.maxQueuePerBarracks)
        .filter((b) => b.queue === 0 || b.trainType === unitType)
        .sort((a, b) => a.queue - b.queue)[0];
      if (!target) {
        error = 'All eligible barracks are training a different unit type.';
        break;
      }
      target.queue += 1;
      target.trainType = unitType;
      player.gold -= trainStats.cost;
      player.stats.goldSpent += trainStats.cost;
      queued += 1;
    }
    if (!queued) return { ok: false, error };
    return { ok: true, message: `${queued} ${trainStats.label.toLowerCase()}${queued > 1 ? 's' : ''} queued.` };
  }

  private moveUnits(
    side: Side,
    unitIds: number[],
    x: number,
    y: number,
    attack: boolean,
    targetId?: number,
    formation?: FormationType
  ): CommandResult {
    const wanted = new Set(unitIds);
    const units = this.state.units.filter((u) => u.side === side && wanted.has(u.id));
    if (!units.length) return { ok: false, error: 'No troops selected.' };
    const selectedFormation = formation ?? 'line';
    const targeted = this.assignOrders(side, units, x, y, attack, targetId, selectedFormation);
    const verb = targeted ? 'attacking the target' : attack ? 'attacking' : 'moving';
    return { ok: true, message: `${units.length} troop${units.length > 1 ? 's' : ''} ${verb} in ${FORMATION_STATS[selectedFormation].label} formation.` };
  }

  private commandArmy(
    side: Side,
    fraction: ArmyFraction,
    x: number,
    y: number,
    targetId?: number,
    formation?: FormationType
  ): CommandResult {
    const army = this.armyOf(side);
    if (!army.length) return { ok: false, error: 'You have no troops.' };
    const amount = Math.max(1, Math.ceil(army.length * fractionOf(fraction)));
    const chosen = army
      .map((u) => ({ u, idle: u.order.kind === 'idle' ? 0 : 1, d: dist(u.x, u.y, x, y) }))
      .sort((a, b) => a.idle - b.idle || a.d - b.d)
      .slice(0, amount)
      .map((entry) => entry.u);
    const selectedFormation = formation ?? 'line';
    this.assignOrders(side, chosen, x, y, true, targetId, selectedFormation);
    return { ok: true, message: `${chosen.length} troop${chosen.length > 1 ? 's' : ''} received ${FORMATION_STATS[selectedFormation].label} formation orders.` };
  }

  private stopUnits(side: Side, unitIds: number[]): CommandResult {
    const wanted = new Set(unitIds);
    let stopped = 0;
    for (const u of this.state.units) {
      if (u.side !== side || !wanted.has(u.id)) continue;
      u.order = { kind: 'idle' };
      u.formation = undefined;
      this.clearFallback(u);
      this.resetNavigation(u);
      stopped += 1;
    }
    return stopped ? { ok: true, message: 'Troops holding position.' } : { ok: false, error: 'No troops selected.' };
  }

  private fallback(side: Side, unitIds?: number[]): CommandResult {
    const wanted = unitIds ? new Set(unitIds) : null;
    const eligible = this.state.units.filter(
      (u) =>
        u.side === side &&
        u.hp > 0 &&
        u.type !== 'militia' &&
        u.garrisonVillageId === undefined &&
        (!wanted || wanted.has(u.id))
    );
    if (!eligible.length) return { ok: false, error: 'No regular troops are available to fall back.' };

    const groupId = nextFallbackGroupId++;
    const center = eligible.reduce(
      (sum, u) => ({ x: sum.x + u.x / eligible.length, y: sum.y + u.y / eligible.length }),
      { x: 0, y: 0 }
    );

    const threats = this.state.units
      .filter((u) => u.side !== side && u.hp > 0 && u.type !== 'militia')
      .map((u) => ({ u, d: dist(center.x, center.y, u.x, u.y) }))
      .filter((entry) => entry.d <= GAME_RULES.fallback.detectionRange)
      .sort((a, b) => a.d - b.d);

    const nearestThreat = threats[0]?.u ?? null;
    const safeGoal = this.closestSafePoint(side, center.x, center.y);
    const rearguardCount =
      eligible.length >= GAME_RULES.fallback.minimumSplitSize
        ? Math.max(
            1,
            Math.min(
              Math.ceil(eligible.length * GAME_RULES.fallback.rearguardRatio),
              Math.floor(eligible.length * 0.35)
            )
          )
        : 0;

    const scored = eligible.map((u) => {
      const nearestEnemy = this.nearestEnemyOf(u, GAME_RULES.fallback.detectionRange);
      const d = nearestEnemy ? dist(u.x, u.y, nearestEnemy.x, nearestEnemy.y) : GAME_RULES.fallback.detectionRange;
      const proximity = Math.max(0.1, 1 / (1 + d / 100));
      const unitWeight = u.type === 'soldier' ? 1.5 : u.type === 'archer' ? 0.1 : 0.8;
      return { u, score: (u.hp / Math.max(1, u.maxHp)) * unitWeight * proximity };
    });
    scored.sort((a, b) => b.score - a.score);

    const rearguards = new Set(scored.slice(0, rearguardCount).map((entry) => entry.u.id));
    const intercept = nearestThreat
      ? this.interceptionPoint(nearestThreat, center, safeGoal)
      : { x: (center.x + safeGoal.x) / 2, y: (center.y + safeGoal.y) / 2 };

    this.ensureNav();

    for (const u of eligible) {
      u.fallbackGroupId = groupId;
      u.fallbackGoal = safeGoal;
      u.fallbackUntilMs = this.state.timeMs + GAME_RULES.fallback.speedBuffMs;
      u.formation = 'line';
      u.blockerId = null;
      u.blockedFor = -1;
      u.blockedUntil = 0;
      if (rearguards.has(u.id)) {
        u.fallbackRole = 'rearguard';
        u.order = { kind: 'move', x: intercept.x, y: intercept.y, attack: true };
      } else {
        u.fallbackRole = 'retreat';
        u.order = { kind: 'move', x: safeGoal.x, y: safeGoal.y, attack: false };
      }
      this.resetNavigation(u);
    }

    const retreaters = eligible.length - rearguards.size;
    return {
      ok: true,
      message: 'Tactical Retreat: ' + retreaters + ' troop' + (retreaters === 1 ? '' : 's') + ' falling back, ' + rearguards.size + ' holding the line!'
    };
  }

  private nearestEnemyOf(u: UnitState, range: number) {
    let best: UnitState | null = null;
    let bestDistance = range;
    for (const other of this.state.units) {
      if (other.side === u.side || other.hp <= 0 || other.type === 'militia') continue;
      const d = dist(u.x, u.y, other.x, other.y);
      if (d <= bestDistance) {
        bestDistance = d;
        best = other;
      }
    }
    return best;
  }

  private closestSafePoint(side: Side, x: number, y: number): Vec2 {
    const priorities: { type: BuildingType; weight: number }[] = [
      { type: 'tower', weight: 4 },
      { type: 'village', weight: 3 },
      { type: 'fence', weight: 2 },
      { type: 'castle', weight: 1 }
    ];

    for (const priority of priorities) {
      const candidates = this.state.buildings.filter(
        (building) => building.side === side && building.hp > 0 && building.type === priority.type
      );
      if (!candidates.length) continue;

      let best = candidates[0];
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const building of candidates) {
        const point =
          building.type === 'fence'
            ? { x: building.x - forwardDir(side) * (BUILDING_STATS.fence.halfWidth + 36), y: building.y }
            : { x: building.x - forwardDir(side) * 52, y: building.y };
        const clamped = clampToIsland(point.x, point.y, UNIT_STATS.soldier.radius + 4);
        const distance = dist(x, y, clamped.x, clamped.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = building;
        }
      }
      const point =
        best.type === 'fence'
          ? { x: best.x - forwardDir(side) * (BUILDING_STATS.fence.halfWidth + 36), y: best.y }
          : { x: best.x - forwardDir(side) * 52, y: best.y };
      return clampToIsland(point.x, point.y, UNIT_STATS.soldier.radius + 4);
    }

    return clampToIsland(x - forwardDir(side) * 180, y, UNIT_STATS.soldier.radius + 4);
  }

  private interceptionPoint(threat: UnitState, center: Vec2, safeGoal: Vec2): Vec2 {
    const dx = safeGoal.x - threat.x;
    const dy = safeGoal.y - threat.y;
    const length = Math.hypot(dx, dy) || 1;
    const point = {
      x: threat.x + (dx / length) * 95,
      y: threat.y + (dy / length) * 95
    };
    return clampToIsland(
      point.x + (center.x - point.x) * 0.08,
      point.y + (center.y - point.y) * 0.08,
      UNIT_STATS.soldier.radius + 4
    );
  }

  private isFallbackGroupSafe(groupId: number) {
    const group = this.state.units.filter((u) => u.fallbackGroupId === groupId && u.hp > 0);
    const retreaters = group.filter((u) => u.fallbackRole === 'retreat');
    if (!retreaters.length) return true;

    const safeGoal = retreaters.find((u) => u.fallbackGoal)?.fallbackGoal;
    const allAtBase = Boolean(
      safeGoal &&
      retreaters.every((u) => dist(u.x, u.y, safeGoal.x, safeGoal.y) <= 48)
    );

    const nearestThreatDistance = Math.min(
      ...retreaters.map((u) => {
        const enemy = this.nearestEnemyOf(u, GAME_RULES.fallback.safeDistance);
        return enemy ? dist(u.x, u.y, enemy.x, enemy.y) : GAME_RULES.fallback.safeDistance;
      })
    );
    return allAtBase || nearestThreatDistance >= GAME_RULES.fallback.safeDistance;
  }

  private updateFallback() {
    const groups = new Set(
      this.state.units
        .filter((u) => u.fallbackRole === 'rearguard' && u.fallbackGroupId !== undefined && u.hp > 0)
        .map((u) => u.fallbackGroupId as number)
    );

    for (const groupId of groups) {
      const rearguards = this.state.units.filter(
        (u) => u.fallbackGroupId === groupId && u.fallbackRole === 'rearguard' && u.hp > 0
      );
      if (!rearguards.length) continue;

      const shouldRoll =
        this.isFallbackGroupSafe(groupId) ||
        rearguards.every((u) => u.hp / Math.max(1, u.maxHp) < 0.4);
      if (!shouldRoll) continue;

      const goal = rearguards.find((u) => u.fallbackGoal)?.fallbackGoal;
      if (!goal) continue;

      for (const u of rearguards) {
        u.fallbackRole = 'retreat';
        u.order = { kind: 'move', x: goal.x, y: goal.y, attack: false };
        u.fallbackUntilMs = this.state.timeMs;
        this.resetNavigation(u);
      }
    }
  }

  private clearFallback(u: UnitState) {
    u.fallbackRole = undefined;
    u.fallbackUntilMs = undefined;
    u.fallbackGroupId = undefined;
    u.fallbackGoal = undefined;
  }

  private proposePeace(side: Side): CommandResult {
    const player = this.state.players[side];
    if (this.state.peace) return { ok: false, error: 'A peace proposal is already pending.' };
    if (this.state.timeMs < player.peaceCooldownUntil) {
      const wait = Math.ceil((player.peaceCooldownUntil - this.state.timeMs) / 1000);
      return { ok: false, error: `Your messenger is still on the road. Try again in ${wait}s.` };
    }
    this.state.peace = { proposedBy: side, expiresInMs: GAME_RULES.peace.responseWindowMs };
    player.peaceCooldownUntil = this.state.timeMs + GAME_RULES.peace.cooldownMs;
    this.events.push({ type: 'peaceProposed', by: side });
    return { ok: true, message: 'Peace proposal sent.' };
  }

  private respondPeace(side: Side, accept: boolean): CommandResult {
    const peace = this.state.peace;
    if (!peace || peace.proposedBy === side) return { ok: false, error: 'There is no proposal to answer.' };
    this.state.peace = null;
    if (accept) {
      this.finish(null, 'peace');
      return { ok: true };
    }
    this.events.push({ type: 'peaceDeclined', by: side });
    return { ok: true, message: 'Peace proposal declined.' };
  }

  /** Returns true when the units were given a specific enemy to attack. */
  private assignOrders(
    side: Side,
    units: UnitState[],
    rawX: number,
    rawY: number,
    attack: boolean,
    targetId: number | undefined,
    formation: FormationType
  ) {
    const selectedFormation = FORMATION_TYPES.includes(formation) ? formation : 'line';
    const target = targetId === undefined ? undefined : this.findEntity(targetId);
    if (target && target.side !== side && target.hp > 0) {
      for (const u of units) {
        u.formation = selectedFormation;
        u.order = { kind: 'attack', targetId: target.id };
        this.resetNavigation(u);
      }
      return true;
    }
    this.ensureNav();
    const center = units.reduce((sum, u) => ({ x: sum.x + u.x / units.length, y: sum.y + u.y / units.length }), { x: 0, y: 0 });
    const facing = Math.atan2(rawY - center.y, rawX - center.x);
    const offsets = formationOffsets(units.length, selectedFormation, FORMATION_STATS[selectedFormation].spacing, facing);
    const sortedOffsets = [...offsets].sort((a, b) => a.y - b.y || a.x - b.x);
    const sorted = [...units].sort((a, b) => a.y - b.y || a.x - b.x);
    const radius = UNIT_STATS.soldier.radius;
    sorted.forEach((u, i) => {
      const offset = sortedOffsets[i];
      const clamped = clampToIsland(rawX + offset.x, rawY + offset.y, radius + 4);
      const goal = this.nav.openPoint(side, clamped.x, clamped.y);
      u.formation = selectedFormation;
      u.order = { kind: 'move', x: goal.x, y: goal.y, attack };
      this.resetNavigation(u);
    });
    return false;
  }

  // -------------------------------------------------------------- simulation

  private tick(dt: number) {
    const s = this.state;
    s.timeMs += dt;
    this.pathBudget = PATHS_PER_TICK;

    s.nextIncomeInMs -= dt;
    if (s.nextIncomeInMs <= 0) {
      s.nextIncomeInMs += GAME_RULES.economy.incomeIntervalMs;
      for (const side of SIDES) {
        const p = s.players[side];
        const grossIncome = p.income;
        p.gold += grossIncome;
        p.stats.goldEarned += grossIncome;

        const supply = armySupplyCapacity(this.buildingsOf(side));
        const upkeep = armyUpkeep(this.armyOf(side).length, supply);
        const paidUpkeep = Math.min(p.gold, upkeep);
        p.gold -= paidUpkeep;
        p.stats.goldSpent += paidUpkeep;
      }
    }

    if (s.peace) {
      s.peace.expiresInMs -= dt;
      if (s.peace.expiresInMs <= 0) {
        s.peace = null;
        this.events.push({ type: 'peaceExpired' });
      }
    }

    this.ensureNav();
    this.updateBuildings(dt);
    this.updateUnits(dt);
    this.resolveCollisions();
    this.removeDead();

    for (const side of SIDES) {
      const stats = s.players[side].stats;
      stats.peakArmy = Math.max(stats.peakArmy, this.armyOf(side).length);
    }

    if (!this.ended && s.timeMs >= GAME_RULES.maxMatchMs) {
      const ratio = (side: Side) => {
        const castle = this.castleOf(side);
        return castle ? castle.hp / castle.maxHp : 0;
      };
      const blue = ratio('blue');
      const red = ratio('red');
      this.finish(Math.abs(blue - red) < 0.01 ? null : blue > red ? 'blue' : 'red', 'timeout');
    }
  }

  private ensureNav() {
    if (!this.navDirty) return;
    this.navDirty = false;
    this.nav.rebuild(this.state.buildings);
    for (const u of this.state.units) {
      this.resetNavigation(u);
      // A new wall may cover a destination; walk to the nearest open spot instead.
      if (u.order.kind === 'move') {
        const goal = this.nav.openPoint(u.side, u.order.x, u.order.y);
        u.order = { ...u.order, x: goal.x, y: goal.y };
      }
    }
  }

  private updateBuildings(dt: number) {
    const s = this.state;
    const soldier = UNIT_STATS.soldier;
    for (const b of s.buildings) {
      if (b.hp <= 0) continue;
      const stats = BUILDING_STATS[b.type];

      if (b.type === 'barracks') {
        const trainingType = b.trainType ?? 'soldier';
        const trainingStats = UNIT_STATS[trainingType];
        if (b.queue > 0 && this.armyOf(b.side).length < GAME_RULES.limits.maxUnitsPerSide) {
          b.trainMs += dt;
          if (b.trainMs >= trainingStats.trainMs) {
            b.trainMs = 0;
            b.queue -= 1;
            const spawn = clampToIsland(
              b.x + (Math.random() - 0.5) * 36,
              b.y + forwardDir(b.side) * (stats.halfHeight + trainingStats.radius + 8),
              trainingStats.radius
            );
            this.spawnUnit(b.side, trainingType, spawn.x, spawn.y);
            s.players[b.side].stats.unitsTrained += 1;
            this.events.push({ type: 'unitTrained', side: b.side, x: spawn.x, y: spawn.y });
            if (b.queue === 0) b.trainType = null;
          }
        } else if (b.queue === 0) {
          b.trainMs = 0;
          b.trainType = null;
        }
        b.trainProgress = b.trainMs / Math.max(1, trainingStats.trainMs);
      }

      if (stats.attack) {
        b.cooldownMs -= dt;
        if (b.cooldownMs <= 0) {
          let target: UnitState | null = null;
          let best = stats.attack.range + soldier.radius;
          for (const u of s.units) {
            if (u.side === b.side || u.hp <= 0) continue;
            const d = distanceToBuilding(b, u.x, u.y);
            if (d <= best) {
              best = d;
              target = u;
            }
          }
          if (target) {
            b.cooldownMs = stats.attack.cooldownMs;
            this.damage(b.side, target, stats.attack.damage);
            this.events.push({
              type: 'shot',
              side: b.side,
              fromX: b.x,
              fromY: b.y - stats.halfHeight * 0.8,
              toX: Math.round(target.x),
              toY: Math.round(target.y)
            });
          } else {
            b.cooldownMs = 0;
          }
        }
      }
    }
  }

  private updateUnits(dt: number) {
    const s = this.state;
    this.updateFallback();
    for (const u of s.units) {
      u.prevX = u.x;
      u.prevY = u.y;
    }

    for (const u of s.units) {
      if (u.hp <= 0) continue;
      const stats = UNIT_STATS[u.type];
      const formation = FORMATION_STATS[u.formation ?? 'line'];
      u.cooldownMs = Math.max(0, u.cooldownMs - dt);
      const fallbackSpeed = u.fallbackRole === 'retreat' && (u.fallbackUntilMs ?? 0) > s.timeMs ? GAME_RULES.fallback.speedMultiplier : 1;
      const step = (stats.speed * formation.speedMultiplier * fallbackSpeed * dt) / 1000;

      let target: Entity | null = null;
      if (u.order.kind === 'attack') {
        const explicit = this.findEntity(u.order.targetId);
        if (explicit && explicit.hp > 0 && explicit.side !== u.side) target = explicit;
        else u.order = { kind: 'idle' };
      }
      const engage = u.order.kind === 'idle' || (u.order.kind === 'move' && u.order.attack);
      if (!target && engage) target = this.pickTarget(u);

      // A walled-off route turns the blocking fence into the target for a while.
      let blocker: Entity | null = null;
      if (u.blockerId !== null) {
        const wall = this.findEntity(u.blockerId);
        if (wall && wall.hp > 0 && s.timeMs < u.blockedUntil) blocker = wall;
        else u.blockerId = null;
      }
      const goalKey = target ? target.id : -1;
      const aim = blocker && u.blockedFor === goalKey && (target || u.order.kind === 'move') ? blocker : target;

      if (aim) {
        u.targetId = aim.id;
        const attack = isBuilding(aim) ? stats.buildingAttack ?? stats.attack : stats.attack;
        const reach = this.edgeDistance(u, aim) - stats.radius;
        if (reach <= attack.range) {
          if (u.cooldownMs <= 0) {
            u.cooldownMs = attack.cooldownMs;
            u.lastAttackMs = s.timeMs;
            this.damage(u.side, aim, attack.damage, u.formation ?? 'line', u.type);
            if (u.type === 'archer') {
              this.events.push({
                type: 'arrowShot',
                side: u.side,
                fromX: Math.round(u.x),
                fromY: Math.round(u.y - 4),
                toX: Math.round(aim.x),
                toY: Math.round(aim.y),
                targetId: aim.id
              });
            }
            this.events.push({ type: 'hit', x: Math.round(aim.x), y: Math.round(aim.y) });
          }
        } else {
          const point = isBuilding(aim) ? approachPoint(aim, u.x, u.y) : { x: aim.x, y: aim.y };
          const isWall = isBuilding(aim) && aim.type === 'fence';
          const tolerance = isWall ? Infinity : stats.attack.range + stats.radius + (isBuilding(aim) ? 0 : stats.radius);
          const moved = this.navigate(u, point.x, point.y, Math.min(step, reach - stats.attack.range + 1), tolerance, isWall ? aim.id : undefined);
          if (!moved) this.markBlocked(u, point, goalKey);
        }
      } else if (u.order.kind === 'move') {
        u.targetId = null;
        const d = dist(u.x, u.y, u.order.x, u.order.y);
        if (d <= ARRIVE_DISTANCE) {
          u.order = { kind: 'idle' };
          this.resetNavigation(u);
        } else if (!this.navigate(u, u.order.x, u.order.y, Math.min(step, d), formation.spacing)) {
          if (u.order.attack) this.markBlocked(u, u.order, -1);
          else u.order = { kind: 'idle' };
        }
      } else {
        u.targetId = null;
      }

      u.moving = Math.abs(u.x - u.prevX) + Math.abs(u.y - u.prevY) > 0.05;
      u.attacking = s.timeMs - u.lastAttackMs < ATTACK_ANIMATION_MS;
    }
  }

  /** Enemy troops first, then the current building target, then buildings in range. Fences are never picked. */
  private pickTarget(u: UnitState): Entity | null {
    const aggro = UNIT_STATS[u.type].aggroRange;

    let nearestUnit: UnitState | null = null;
    let nearestUnitDist = aggro;
    for (const other of this.state.units) {
      if (other.side === u.side || other.hp <= 0) continue;
      const d = dist(u.x, u.y, other.x, other.y);
      if (d <= nearestUnitDist) {
        nearestUnitDist = d;
        nearestUnit = other;
      }
    }

    const current = u.targetId !== null ? this.findEntity(u.targetId) : undefined;
    if (current && current.hp > 0 && current.side !== u.side && !(isBuilding(current) && current.type === 'fence')) {
      const gap = this.edgeDistance(u, current);
      if (!isBuilding(current) && gap <= aggro * LEASH_MULTIPLIER) return current;
      if (isBuilding(current) && !nearestUnit && gap <= aggro * LEASH_MULTIPLIER) return current;
    }
    if (nearestUnit) return nearestUnit;

    let nearestBuilding: BuildingState | null = null;
    const buildingRange = UNIT_STATS[u.type].buildingAttack?.range ?? aggro;
    let nearestBuildingGap = buildingRange;
    for (const b of this.state.buildings) {
      if (b.side === u.side || b.hp <= 0 || b.type === 'fence') continue;
      const gap = distanceToBuilding(b, u.x, u.y);
      if (gap <= nearestBuildingGap) {
        nearestBuildingGap = gap;
        nearestBuilding = b;
      }
    }
    return nearestBuilding;
  }

  private edgeDistance(u: UnitState, target: Entity) {
    if (isBuilding(target)) return distanceToBuilding(target, u.x, u.y);
    return dist(u.x, u.y, target.x, target.y) - UNIT_STATS[target.type].radius;
  }

  /**
   * Moves a unit towards a goal, staying on the island and walking around enemy fences.
   * Returns false when no acceptable route exists.
   */
  private navigate(u: UnitState, gx: number, gy: number, step: number, tolerance: number, ignoreWallId?: number) {
    if (step <= 0) return true;
    const nav = this.nav;
    if (nav.lineClear(u.side, u.x, u.y, gx, gy, ignoreWallId)) {
      u.path = null;
      this.stepTowards(u, gx, gy, step);
      return true;
    }

    const stale =
      !u.path ||
      !u.pathGoal ||
      u.pathVersion !== nav.version ||
      dist(u.pathGoal.x, u.pathGoal.y, gx, gy) > 24 ||
      this.state.timeMs - u.pathAt > PATH_REFRESH_MS;
    if (stale) {
      if (this.pathBudget <= 0) return true;
      this.pathBudget -= 1;
      const result = nav.findPath(u.side, u, { x: gx, y: gy }, ignoreWallId);
      u.pathGoal = { x: gx, y: gy };
      u.pathVersion = nav.version;
      u.pathAt = this.state.timeMs;
      if (!result || dist(result.end.x, result.end.y, gx, gy) > tolerance) {
        u.path = null;
        return false;
      }
      u.path = result.points;
    }

    const path = u.path;
    if (!path || !path.length) {
      u.path = null;
      return true;
    }
    while (path.length > 1 && (dist(path[0].x, path[0].y, u.x, u.y) < 6 || nav.lineClear(u.side, u.x, u.y, path[1].x, path[1].y, ignoreWallId))) {
      path.shift();
    }
    const next = path[0];
    const d = dist(next.x, next.y, u.x, u.y);
    if (d < 1) {
      path.shift();
      return true;
    }
    this.stepTowards(u, next.x, next.y, Math.min(step, d));
    return true;
  }

  private markBlocked(u: UnitState, goal: Vec2, blockedFor: number) {
    const wallId =
      this.nav.wallToBreach(u.side, u, goal) ??
      this.nav.firstWall(u.side, u.x, u.y, goal.x, goal.y)?.id ??
      this.nav.wallAt(u.side, goal.x, goal.y) ??
      this.nearestWall(u);
    if (wallId === null) return;
    u.blockerId = wallId;
    u.blockedFor = blockedFor;
    u.blockedUntil = this.state.timeMs + BLOCKED_RETRY_MS;
    u.path = null;
  }

  private nearestWall(u: UnitState) {
    let best: number | null = null;
    let bestGap = UNIT_STATS[u.type].aggroRange * 2;
    for (const b of this.state.buildings) {
      if (b.type !== 'fence' || b.side === u.side || b.hp <= 0) continue;
      const gap = distanceToBuilding(b, u.x, u.y);
      if (gap < bestGap) {
        bestGap = gap;
        best = b.id;
      }
    }
    return best;
  }

  private resetNavigation(u: UnitState) {
    u.path = null;
    u.pathGoal = null;
    u.blockerId = null;
    u.targetId = null;
  }

  private stepTowards(u: UnitState, tx: number, ty: number, step: number) {
    if (step <= 0) return;
    const d = dist(u.x, u.y, tx, ty);
    if (d < 0.001) return;
    const move = Math.min(step, d);
    u.x += ((tx - u.x) / d) * move;
    u.y += ((ty - u.y) / d) * move;
  }

  private resolveCollisions() {
    const units = this.state.units;
    const radius = UNIT_STATS.soldier.radius;
    const minDist = radius * 2;
    for (let i = 0; i < units.length; i++) {
      const a = units[i];
      for (let j = i + 1; j < units.length; j++) {
        const b = units[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minDist * minDist) continue;
        const d = Math.sqrt(d2) || 0.01;
        const push = (minDist - d) / 2;
        const nx = d2 === 0 ? Math.cos(i + j) : dx / d;
        const ny = d2 === 0 ? Math.sin(i + j) : dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }

    for (const u of units) {
      for (const building of this.state.buildings) {
        const stats = BUILDING_STATS[building.type];
        if (stats.shape === 'circle') {
          const r = stats.halfWidth + radius;
          const dx = u.x - building.x;
          const dy = u.y - building.y;
          const d2 = dx * dx + dy * dy;
          if (d2 >= r * r) continue;
          const d = Math.sqrt(d2) || 0.01;
          u.x = building.x + (dx / d) * r;
          u.y = building.y + (dy / d) * r;
          continue;
        }
        // Troops walk through their own fences.
        if (building.side === u.side) continue;
        const minX = building.x - stats.halfWidth - radius;
        const maxX = building.x + stats.halfWidth + radius;
        const minY = building.y - stats.halfHeight - radius;
        const maxY = building.y + stats.halfHeight + radius;
        if (u.x <= minX || u.x >= maxX || u.y <= minY || u.y >= maxY) continue;
        // Push back towards the side the unit came from, so crowds cannot tunnel through.
        if (u.prevY <= minY) u.y = minY;
        else if (u.prevY >= maxY) u.y = maxY;
        else if (u.prevX <= minX) u.x = minX;
        else if (u.prevX >= maxX) u.x = maxX;
        else {
          const exits = [
            { d: u.y - minY, apply: () => (u.y = minY) },
            { d: maxY - u.y, apply: () => (u.y = maxY) },
            { d: u.x - minX, apply: () => (u.x = minX) },
            { d: maxX - u.x, apply: () => (u.x = maxX) }
          ];
          exits.sort((p, q) => p.d - q.d)[0].apply();
        }
      }
      const clamped = clampToIsland(u.x, u.y, radius);
      u.x = clamped.x;
      u.y = clamped.y;
    }
  }

  /**
   * Knights punish unprepared, free-form troops. When a Knight hits a Soldier or Archer that is
   * actively participating in a nearby 2+ unit formation, its damage is reduced by exactly 3%.
   */
  private damage(
    attacker: Side,
    target: Entity,
    amount: number,
    attackerFormation?: FormationType,
    attackerType?: UnitType
  ) {
    let effective = amount;
    if (attackerFormation) effective *= FORMATION_STATS[attackerFormation].attackMultiplier;

    if (!isBuilding(target)) {
      if (target.fallbackRole === 'rearguard') {
        effective *= 1 - GAME_RULES.fallback.rearguardDamageReduction;
      }
      effective *= FORMATION_STATS[target.formation ?? 'line'].defenseMultiplier;

      if (attackerType === 'knight' && this.isKnightCounterFormation(target)) {
        effective *= 0.97;
      }
    }

    const dealt = Math.min(target.hp, effective);
    target.hp -= effective;
    this.state.players[attacker].stats.damageDealt += dealt;
  }

  /**
   * A formation penalty only applies when the Soldier/Archer is actually backed by another
   * matching Soldier/Archer nearby. This prevents a single unit's stored formation value from
   * accidentally granting the Knight counter bonus.
   */
  private isKnightCounterFormation(target: UnitState) {
    if (target.type !== 'soldier' && target.type !== 'archer') return false;

    const formation = target.formation ?? null;
    if (!formation || target.order.kind === 'idle') return false;

    const formationRadius = 110;
    let members = 0;
    for (const unit of this.state.units) {
      if (unit.side !== target.side || unit.hp <= 0) continue;
      if (unit.type !== 'soldier' && unit.type !== 'archer') continue;
      if (unit.formation !== formation || unit.order.kind === 'idle') continue;
      if (dist(unit.x, unit.y, target.x, target.y) <= formationRadius) {
        members += 1;
        if (members >= 2) return true;
      }
    }
    return false;
  }

  private removeDead() {
    const s = this.state;
    if (s.units.some((u) => u.hp <= 0)) {
      s.units = s.units.filter((u) => {
        if (u.hp > 0) return true;
        s.players[u.side].stats.unitsLost += 1;
        s.players[opponentOf(u.side)].stats.kills += 1;
        this.events.push({ type: 'unitDied', side: u.side, x: Math.round(u.x), y: Math.round(u.y) });
        return false;
      });
    }
    if (s.buildings.some((b) => b.hp <= 0)) {
      let castleFell: Side | null = null;
      s.buildings = s.buildings.filter((b) => {
        if (b.hp > 0) return true;
        this.events.push({ type: 'buildingDestroyed', side: b.side, building: b.type, x: b.x, y: b.y });
        if (b.type === 'fence') this.navDirty = true;
        if (b.type === 'castle') {
          castleFell = b.side;
        } else {
          s.players[b.side].stats.buildingsLost += 1;
          s.players[opponentOf(b.side)].stats.buildingsDestroyed += 1;
        }
        return false;
      });
      this.refreshIncome();
      if (castleFell) this.finish(opponentOf(castleFell), 'castle');
    }
  }

  private findEntity(id: number): Entity | undefined {
    return this.state.units.find((u) => u.id === id) ?? this.state.buildings.find((b) => b.id === id);
  }

  private finish(winner: Side | null, reason: EndReason) {
    if (this.state.result) return;
    this.state.peace = null;
    this.state.result = { winner, reason, timeMs: this.state.timeMs };
    this.events.push({ type: 'matchEnded', result: this.state.result });
  }

  private refreshIncome() {
    for (const side of SIDES) {
      this.state.players[side].income = incomeFor(this.buildingsOf(side, 'village').length);
    }
  }

  private createPlayer(side: Side) {
    return { side, gold: GAME_RULES.economy.startingGold, income: 0, stats: emptyStats(), peaceCooldownUntil: 0 };
  }

  private spawnBuilding(side: Side, type: BuildingType, x: number, y: number) {
    const hp = BUILDING_STATS[type].hp;
    const building: BuildingState = {
      id: this.state.nextId++,
      side,
      type,
      x,
      y,
      hp,
      maxHp: hp,
      queue: 0,
      trainProgress: 0,
      trainType: null,
      cooldownMs: 0,
      trainMs: 0
    };
    this.state.buildings.push(building);
    return building;
  }

  private spawnUnit(side: Side, type: UnitType, x: number, y: number) {
    const hp = UNIT_STATS[type].hp;
    const unit: UnitState = {
      id: this.state.nextId++,
      side,
      type,
      formation: 'line',
      x,
      y,
      hp,
      maxHp: hp,
      moving: false,
      attacking: false,
      order: { kind: 'idle' },
      targetId: null,
      cooldownMs: 0,
      lastAttackMs: -1e9,
      prevX: x,
      prevY: y,
      path: null,
      pathGoal: null,
      pathVersion: -1,
      pathAt: 0,
      blockerId: null,
      blockedFor: -1,
      blockedUntil: 0,
      fallbackRole: undefined,
      fallbackUntilMs: undefined,
      fallbackGroupId: undefined,
      fallbackGoal: undefined
    };
    this.state.units.push(unit);
    return unit;
  }
}
