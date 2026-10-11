import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FORMATION_STATS, FORMATION_TYPES, GAME_RULES, MatchEngine, SIDES, UNIT_STATS,
  decodeSnapshot, emptyStats, encodeSnapshot, opponentOf, parseCommand,
  type FormationType, type Side, type UnitType
} from '../src/index.js';

const UNIT_TYPES: UnitType[] = ['soldier', 'militia', 'archer', 'knight', 'scout', 'royal_guard', 'cannon'];

test('v6 codec round-trips every unit type, side, movement, attack, rearguard and retreat flag', () => {
  const engine = new MatchEngine();
  const template = engine.state.units[0];
  const units = [];
  for (const type of UNIT_TYPES) for (const side of SIDES) {
    for (const moving of [false, true]) for (const attacking of [false, true]) {
      for (const rearguard of [false, true]) for (const retreating of [false, true]) {
        units.push({ ...template, id: units.length + 1, type, side, moving, attacking, rearguard, retreating });
      }
    }
  }
  const wire = encodeSnapshot({ ...engine.state, units }, []);
  const decoded = decodeSnapshot(JSON.parse(JSON.stringify(wire))).view.units;
  for (const unit of units) {
    const result = decoded.find((entry) => entry.id === unit.id)!;
    for (const key of ['type', 'side', 'moving', 'attacking', 'rearguard', 'retreating'] as const) {
      assert.equal(result[key], unit[key], `unit ${unit.id} ${unit.type} ${key}`);
    }
  }
  assert.equal(wire.v, 6);
});

test('codec refuses missing, old and future versions with a clear protocol error', () => {
  const wire = encodeSnapshot(new MatchEngine().state, []);
  for (const v of [undefined, 1, 3, 5, 7]) {
    assert.throws(() => decodeSnapshot({ ...wire, v }), /Unsupported snapshot protocol version.*expected 6/i);
  }
});

test('v6 packs optional formation metadata without increasing unit stride', () => {
  const engine = new MatchEngine();
  const template = engine.state.units[0];
  const units = SIDES.flatMap((side) => [undefined, ...FORMATION_TYPES].map((formation, i) => ({
    ...template, id: i + 1, side, formation, type: 'cannon' as const, rearguard: true, retreating: true
  })));
  const wire = encodeSnapshot({ ...engine.state, units }, []);
  const decoded = decodeSnapshot(wire).view.units;
  assert.equal(wire.u.length, units.length * 6);
  decoded.forEach((unit, i) => {
    assert.equal(unit.formation, units[i].formation);
    assert.equal(unit.type, 'cannon');
    assert.equal(unit.rearguard, true);
    assert.equal(unit.retreating, true);
  });
});

test('v6 preserves all training types and eight fence orientations for both sides', () => {
  const engine = new MatchEngine();
  const template = engine.state.buildings[0];
  const buildings = SIDES.flatMap((side) => UNIT_TYPES.flatMap((trainType) =>
    Array.from({ length: 8 }, (_, rotation) => ({ ...template, side, type: 'fence' as const, trainType, rotation }))));
  const wire = encodeSnapshot({ ...engine.state, buildings }, []);
  const decoded = decodeSnapshot(wire).view.buildings;
  decoded.forEach((building, i) => {
    assert.equal(building.side, buildings[i].side);
    assert.equal(building.trainType, buildings[i].trainType);
    assert.equal(building.rotation, buildings[i].rotation);
  });
});

function combat(side: Side, formation: FormationType, knight = false, rearguard = false) {
  const engine = new MatchEngine();
  engine.state.buildings = [];
  const attacker = engine.armyOf(side)[0];
  const target = engine.armyOf(opponentOf(side))[0];
  const support = engine.armyOf(opponentOf(side))[1];
  engine.state.units = [attacker, target, support];
  Object.assign(attacker, { x: 960, y: 540, type: knight ? 'knight' : 'soldier', formation: 'column' });
  Object.assign(target, { x: 980, y: 540, hp: 100, formation, cooldownMs: 999_999 });
  Object.assign(support, { x: 1000, y: 540, formation, cooldownMs: 999_999 });
  target.order = { kind: 'move', x: 1100, y: 540, attack: false };
  support.order = { kind: 'move', x: 1120, y: 540, attack: false };
  if (rearguard) target.fallbackRole = 'rearguard';
  assert.equal(engine.command(side, { type: 'move', unitIds: [attacker.id], x: target.x, y: target.y,
    attack: true, targetId: target.id, formation: 'column' }).ok, true);
  engine.update(GAME_RULES.tickMs);
  return { damage: 100 - target.hp, stats: engine.state.players[side].stats.damageDealt };
}

test('formation defence divides damage received in actual combat on both sides', () => {
  for (const side of SIDES) for (const formation of FORMATION_TYPES) {
    const { damage, stats } = combat(side, formation);
    const expected = UNIT_STATS.soldier.attack.damage / FORMATION_STATS[formation].defenseMultiplier;
    assert.ok(Math.abs(damage - expected) < 1e-9, `${side} ${formation}: ${damage} vs ${expected}`);
    assert.ok(Math.abs(stats - expected) < 1e-9);
  }
  assert.ok(combat('blue', 'square').damage < combat('blue', 'line').damage);
});

test('defence composes with Knight counter and Fall Back damage reduction', () => {
  for (const side of SIDES) {
    const { damage } = combat(side, 'square', true, true);
    const expected = UNIT_STATS.knight.attack.damage / FORMATION_STATS.square.defenseMultiplier *
      0.97 * (1 - GAME_RULES.fallback.rearguardDamageReduction);
    assert.ok(Math.abs(damage - expected) < 1e-9, `${side}: ${damage} vs ${expected}`);
  }
});

test('raw target commands reject hidden unit/building IDs exactly like unknown IDs for both sides', () => {
  for (const side of SIDES) for (const kind of ['unit', 'building'] as const) {
    const engine = new MatchEngine();
    const unit = engine.armyOf(side)[0];
    const target = kind === 'unit' ? engine.armyOf(opponentOf(side))[0] : engine.buildingsOf(opponentOf(side))[1];
    const view = engine.viewForSide(side);
    assert.ok(![...view.units, ...view.buildings].some((entity) => entity.id === target.id));
    for (const type of ['move', 'army'] as const) {
      const raw = { type, unitIds: [unit.id], fraction: 'all', x: target.x, y: target.y, attack: true, targetId: target.id };
      const before = structuredClone(unit.order);
      const hidden = engine.command(side, parseCommand(raw)!);
      const unknown = engine.command(side, parseCommand({ ...raw, targetId: 999_999 })!);
      assert.equal(hidden.ok, false, `${side} hidden ${kind} ${type}`);
      assert.deepEqual(hidden, unknown);
      assert.deepEqual(unit.order, before);
    }
    assert.equal(engine.command(side, { type: 'move', unitIds: [unit.id], x: target.x, y: target.y, attack: true }).ok, true);
  }
});

test('explicit unit/building target loses vision, moves to last visible point, and can be retargeted on reveal', () => {
  for (const side of SIDES) for (const kind of ['unit', 'building'] as const) {
    const engine = new MatchEngine();
    const unit = engine.armyOf(side)[0];
    const target = kind === 'unit' ? engine.armyOf(opponentOf(side))[0] : engine.buildingsOf(opponentOf(side))[1];
    const last = { x: side === 'blue' ? 1200 : 720, y: 450 };
    Object.assign(target, last);
    if ('order' in target) target.order = { kind: 'move', ...last, attack: false };
    Object.assign(unit, { x: last.x + (side === 'blue' ? -100 : 100), y: last.y });
    if ('cooldownMs' in target) target.cooldownMs = 999_999;
    const command = { type: 'move' as const, unitIds: [unit.id], ...last, attack: true, targetId: target.id };
    assert.equal(engine.command(side, command).ok, true);
    engine.update(GAME_RULES.tickMs);
    const latest = { x: last.x + (side === 'blue' ? 20 : -20), y: last.y };
    Object.assign(target, latest);
    if ('order' in target) target.order = { kind: 'move', ...latest, attack: false };
    engine.update(GAME_RULES.tickMs);
    Object.assign(unit, { x: side === 'blue' ? 700 : 1220, y: 450 });
    Object.assign(target, { x: side === 'blue' ? 1750 : 170, y: 450 });
    assert.ok(![...engine.viewForSide(side).units, ...engine.viewForSide(side).buildings].some((entity) => entity.id === target.id));
    engine.update(GAME_RULES.tickMs);
    assert.equal(unit.order.kind, 'move');
    if (unit.order.kind === 'move') assert.deepEqual({ x: unit.order.x, y: unit.order.y }, latest);
    assert.equal(unit.targetId, null);
    Object.assign(target, last);
    Object.assign(unit, { x: last.x + (side === 'blue' ? -100 : 100), y: last.y });
    assert.equal(engine.command(side, command).ok, true);
    assert.equal(unit.order.kind, 'attack');
  }
});

test('Cannon auto targeting respects fog despite attack range exceeding its vision', () => {
  for (const side of SIDES) {
    const engine = new MatchEngine();
    engine.state.buildings = [];
    const cannon = engine.armyOf(side)[0];
    const enemy = engine.armyOf(opponentOf(side))[0];
    engine.state.units = [cannon, enemy];
    Object.assign(cannon, { type: 'cannon', x: side === 'blue' ? 1100 : 820, y: 540 });
    Object.assign(enemy, { x: side === 'blue' ? 1400 : 520, y: 540 });
    const before = enemy.hp;
    engine.update(GAME_RULES.tickMs);
    assert.equal(enemy.hp, before);
    assert.equal(cannon.targetId, null);
  }
});

test('live observer and wire redact opponent economics/statistics without changing engine state', () => {
  const engine = new MatchEngine();
  for (const side of SIDES) {
    engine.state.players[side].gold = side === 'blue' ? 1337 : 2448;
    engine.state.players[side].stats.goldEarned = side === 'blue' ? 777 : 888;
  }
  for (const side of SIDES) {
    const enemy = opponentOf(side);
    const view = engine.viewForSide(side);
    const wire = decodeSnapshot(encodeSnapshot(view, [])).view;
    for (const observer of [view, wire]) {
      assert.equal(observer.players[enemy].gold, 0);
      assert.equal(observer.players[enemy].income, 0);
      assert.deepEqual(observer.players[enemy].stats, emptyStats());
      assert.equal(observer.players[enemy].privateInfoVisible, false);
      assert.equal(observer.players[side].privateInfoVisible, true);
      assert.equal(observer.players[side].gold, engine.state.players[side].gold);
      assert.deepEqual(observer.players[side].stats, engine.state.players[side].stats);
    }
  }
  assert.equal(engine.state.players.blue.gold, 1337);
  assert.equal(engine.state.players.red.stats.goldEarned, 888);
  engine.command('blue', { type: 'surrender' });
  for (const side of SIDES) {
    const view = decodeSnapshot(encodeSnapshot(engine.viewForSide(side), [])).view;
    assert.equal(view.units.length, engine.state.units.length);
    assert.equal(view.buildings.length, engine.state.buildings.length);
    for (const player of SIDES) {
      assert.equal(view.players[player].privateInfoVisible, true);
      assert.equal(view.players[player].gold, engine.state.players[player].gold);
      assert.deepEqual(view.players[player].stats, engine.state.players[player].stats);
    }
  }
});

test('enemy projectile events do not reveal a hidden origin or hidden destination', () => {
  for (const side of SIDES) {
    const engine = new MatchEngine();
    const hidden = { x: side === 'blue' ? 1700 : 220, y: 450 };
    const known = { x: 960, y: 450 };
    for (const [from, to] of [[hidden, known], [known, hidden]]) {
      assert.deepEqual(engine.eventsForSide(side, [{ type: 'cannonShot', side: opponentOf(side),
        fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, targetId: 1, radius: 42 }]), []);
    }
  }
});
