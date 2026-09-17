import { clampToIsland } from './island.js';
import { MatchEngine, type UnitState } from './engine.js';
import { BUILDING_STATS, GAME_RULES, UNIT_STATS } from './rules.js';
import { opponentOf, type Command, type Side, type Vec2 } from './types.js';

interface MilitiaRuntime {
  readyVillages: Set<number>;
  activeVillages: Map<number, Set<number>>;
  expectedBefore: Map<number, number>;
}

const runtimes = new WeakMap<MatchEngine, MilitiaRuntime>();

function runtimeOf(engine: MatchEngine): MilitiaRuntime {
  let runtime = runtimes.get(engine);
  if (!runtime) {
    runtime = {
      readyVillages: new Set<number>(),
      activeVillages: new Map<number, Set<number>>(),
      expectedBefore: new Map<number, number>()
    };
    runtimes.set(engine, runtime);
  }
  return runtime;
}

function resetNavigation(unit: UnitState) {
  unit.path = null;
  unit.pathGoal = null;
  unit.pathVersion = -1;
  unit.pathAt = 0;
  unit.blockerId = null;
  unit.blockedFor = -1;
  unit.blockedUntil = 0;
  unit.targetId = null;
}

function distance(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function villageThreats(engine: MatchEngine, villageId: number, side: Side, range: number) {
  const village = engine.state.buildings.find((b) => b.id === villageId && b.type === 'village' && b.hp > 0);
  if (!village) return [];
  return engine.state.units
    .filter((u) => u.side === opponentOf(side) && u.hp > 0)
    .filter((u) => distanceToVillage(village.x, village.y, u.x, u.y) <= range)
    .sort((a, b) => distanceToVillage(village.x, village.y, a.x, a.y) - distanceToVillage(village.x, village.y, b.x, b.y));
}

function distanceToVillage(vx: number, vy: number, ux: number, uy: number) {
  return Math.max(0, Math.hypot(vx - ux, vy - uy) - BUILDING_STATS.village.halfWidth);
}

function findNearestEnemy(engine: MatchEngine, side: Side, x: number, y: number, range: number) {
  return engine.state.units
    .filter((u) => u.side === opponentOf(side) && u.hp > 0)
    .map((u) => ({ unit: u, d: Math.hypot(u.x - x, u.y - y) }))
    .filter(({ d }) => d <= range)
    .sort((a, b) => a.d - b.d)[0]?.unit;
}

function createMilitia(engine: MatchEngine, side: Side, villageId: number, x: number, y: number, targetId: number) {
  const hp = UNIT_STATS.militia.hp;
  const unit: UnitState = {
    id: engine.state.nextId++,
    side,
    type: 'militia',
    formation: undefined,
    garrisonVillageId: villageId,
    x,
    y,
    hp,
    maxHp: hp,
    moving: false,
    attacking: false,
    order: { kind: 'attack', targetId },
    targetId,
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
    blockedUntil: 0
  };
  engine.state.units.push(unit);
  return unit;
}

function deploy(engine: MatchEngine, villageId: number) {
  const runtime = runtimeOf(engine);
  if (!runtime.readyVillages.has(villageId) || runtime.activeVillages.has(villageId)) return;
  const village = engine.state.buildings.find((b) => b.id === villageId && b.type === 'village' && b.hp > 0);
  if (!village) return;
  const threats = villageThreats(engine, villageId, village.side, GAME_RULES.militia.triggerRange);
  const firstThreat = threats[0];
  if (!firstThreat) return;

  const angle = Math.atan2(firstThreat.y - village.y, firstThreat.x - village.x);
  const side = village.side;
  const spawnRadius = GAME_RULES.militia.spawnDistance;
  const positions = [-0.72, 0, 0.72].map((offset) => {
    const theta = angle + offset;
    return clampToIsland(village.x + Math.cos(theta) * spawnRadius, village.y + Math.sin(theta) * spawnRadius, UNIT_STATS.militia.radius);
  });
  const ids = new Set<number>();
  for (const point of positions) {
    const unit = createMilitia(engine, side, villageId, point.x, point.y, firstThreat.id);
    ids.add(unit.id);
  }
  runtime.activeVillages.set(villageId, ids);
  runtime.expectedBefore.set(villageId, ids.size);
}

function prepare(engine: MatchEngine) {
  const runtime = runtimeOf(engine);
  const villages = engine.state.buildings.filter((b) => b.type === 'village' && b.hp > 0);
  const liveVillageIds = new Set(villages.map((v) => v.id));

  for (const id of [...runtime.readyVillages]) if (!liveVillageIds.has(id)) runtime.readyVillages.delete(id);
  for (const [id] of [...runtime.activeVillages]) if (!liveVillageIds.has(id)) runtime.activeVillages.delete(id);
  for (const id of [...runtime.expectedBefore.keys()]) if (!liveVillageIds.has(id)) runtime.expectedBefore.delete(id);

  for (const village of villages) {
    if (!runtime.readyVillages.has(village.id)) runtime.readyVillages.add(village.id);
  }

  for (const village of villages) {
    const activeIds = runtime.activeVillages.get(village.id);
    if (!activeIds) {
      deploy(engine, village.id);
      continue;
    }

    const threats = villageThreats(engine, village.id, village.side, GAME_RULES.militia.leashRange);
    const target = threats[0];
    for (const unit of engine.state.units) {
      if (unit.type !== 'militia' || unit.garrisonVillageId !== village.id || unit.hp <= 0) continue;
      resetNavigation(unit);
      if (target) {
        unit.order = { kind: 'attack', targetId: target.id };
        unit.targetId = target.id;
      } else {
        unit.order = { kind: 'move', x: village.x, y: village.y, attack: false };
      }
    }
    runtime.expectedBefore.set(village.id, [...activeIds].filter((id) => engine.state.units.some((u) => u.id === id && u.hp > 0)).length);
  }
}

function promoteSurvivors(engine: MatchEngine, villageId: number) {
  const survivors = engine.state.units.filter((u) => u.type === 'militia' && u.garrisonVillageId === villageId && u.hp > 0);
  if (!survivors.length) return;

  engine.state.units = engine.state.units.map((unit) => {
    if (unit.type !== 'militia' || unit.garrisonVillageId !== villageId || unit.hp <= 0) return unit;
    const hp = Math.min(unit.hp, UNIT_STATS.soldier.hp);
    const promoted: UnitState = {
      ...unit,
      id: engine.state.nextId++,
      type: 'soldier',
      formation: 'line',
      garrisonVillageId: undefined,
      hp,
      maxHp: UNIT_STATS.soldier.hp,
      moving: false,
      attacking: false,
      order: { kind: 'idle' },
      targetId: null,
      cooldownMs: 0,
      lastAttackMs: -1e9,
      prevX: unit.x,
      prevY: unit.y,
      path: null,
      pathGoal: null,
      pathVersion: -1,
      pathAt: 0,
      blockerId: null,
      blockedFor: -1,
      blockedUntil: 0
    };
    return promoted;
  });
}

function settle(engine: MatchEngine) {
  const runtime = runtimeOf(engine);
  const villageIds = new Set(engine.state.buildings.filter((b) => b.type === 'village').map((b) => b.id));

  for (const [villageId, activeIds] of [...runtime.activeVillages]) {
    const village = engine.state.buildings.find((b) => b.id === villageId && b.type === 'village' && b.hp > 0);
    if (!village) {
      promoteSurvivors(engine, villageId);
      runtime.activeVillages.delete(villageId);
      runtime.readyVillages.delete(villageId);
      runtime.expectedBefore.delete(villageId);
      continue;
    }

    const threats = villageThreats(engine, villageId, village.side, GAME_RULES.militia.leashRange);
    let returned = 0;
    if (!threats.length) {
      const removeIds = new Set(
        engine.state.units
          .filter((u) => u.type === 'militia' && u.garrisonVillageId === villageId && u.hp > 0)
          .filter((u) => distance({ x: village.x, y: village.y }, { x: u.x, y: u.y }) <= GAME_RULES.militia.returnDistance)
          .map((u) => u.id)
      );
      returned = removeIds.size;
      if (removeIds.size) engine.state.units = engine.state.units.filter((u) => !removeIds.has(u.id));
    }

    const survivors = engine.state.units.filter((u) => u.type === 'militia' && u.garrisonVillageId === villageId && u.hp > 0);
    if (!survivors.length) {
      if (returned > 0) runtime.readyVillages.add(villageId);
      else runtime.readyVillages.delete(villageId);
      runtime.activeVillages.delete(villageId);
      runtime.expectedBefore.delete(villageId);
    } else {
      runtime.activeVillages.set(villageId, new Set(survivors.map((u) => u.id)));
    }
  }

  for (const id of [...runtime.activeVillages.keys()]) if (!villageIds.has(id)) runtime.activeVillages.delete(id);
}

function shouldRejectCommand(engine: MatchEngine, side: Side, ids: readonly number[]) {
  const requested = engine.state.units.filter((u) => ids.includes(u.id) && u.side === side);
  const regular = requested.filter((u) => u.type !== 'militia');
  return { requested, regular };
}

const proto = MatchEngine.prototype as MatchEngine.prototype & {
  update: (deltaMs: number) => void;
  command: (side: Side, cmd: Command) => ReturnType<MatchEngine['command']>;
  armyOf: (side: Side) => UnitState[];
};

if (!(proto as unknown as { __militiaPatched?: boolean }).__militiaPatched) {
  const originalUpdate = proto.update;
  const originalCommand = proto.command;
  const originalArmyOf = proto.armyOf;

  proto.armyOf = function patchedArmyOf(this: MatchEngine, side: Side) {
    return originalArmyOf.call(this, side).filter((u) => u.type !== 'militia');
  };

  proto.command = function patchedCommand(this: MatchEngine, side: Side, cmd: Command) {
    if (cmd.type === 'move' || cmd.type === 'stop') {
      const { regular } = shouldRejectCommand(this, side, cmd.unitIds);
      if (!regular.length) return { ok: false, error: 'Militia defend their village automatically.' };
      if (regular.length !== cmd.unitIds.length) cmd = { ...cmd, unitIds: regular.map((u) => u.id) };
    }
    return originalCommand.call(this, side, cmd);
  };

  proto.update = function patchedUpdate(this: MatchEngine, deltaMs: number) {
    prepare(this);
    originalUpdate.call(this, deltaMs);
    settle(this);
  };

  Object.defineProperty(proto, '__militiaPatched', { value: true, configurable: false });
}

export const MILITIA_RULES = GAME_RULES.militia;
