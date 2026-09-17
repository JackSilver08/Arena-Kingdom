import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_STATS, GAME_RULES, MatchEngine, UNIT_STATS } from '../src/index.js';

function run(engine: MatchEngine, ms: number) {
  for (let t = 0; t < ms; t += GAME_RULES.tickMs) engine.update(GAME_RULES.tickMs);
}

function deployBlueMilitia() {
  const engine = new MatchEngine();
  const village = engine.buildingsOf('blue', 'village')[0];
  const attacker = engine.armyOf('red')[0];
  attacker.x = village.x + BUILDING_STATS.village.halfWidth + GAME_RULES.militia.triggerRange - 8;
  attacker.y = village.y;
  run(engine, GAME_RULES.tickMs);
  const militia = engine.state.units.filter((u) => u.type === 'militia' && u.garrisonVillageId === village.id && u.hp > 0);
  return { engine, village, attacker, militia };
}

test('a threatened village deploys three militia with 1.5x hp and 2/3 damage', () => {
  const { engine, village, militia } = deployBlueMilitia();
  assert.equal(militia.length, GAME_RULES.militia.count);
  assert.ok(militia.every((u) => u.maxHp === UNIT_STATS.soldier.hp * GAME_RULES.militia.hpMultiplier));
  assert.ok(militia.every((u) => u.type === 'militia' && u.garrisonVillageId === village.id));
  assert.equal(UNIT_STATS.militia.attack.damage, UNIT_STATS.soldier.attack.damage * GAME_RULES.militia.damageMultiplier);
  assert.equal(engine.armyOf('blue').length, 3, 'militia do not count as regular army');
});

test('militia ignore direct move/stop commands while tied to a living village', () => {
  const { engine, militia } = deployBlueMilitia();
  const id = militia[0].id;
  const result = engine.command('blue', { type: 'move', unitIds: [id], x: 100, y: 100, attack: true });
  assert.equal(result.ok, false);
  assert.match(result.ok ? '' : result.error, /Militia defend their village automatically/);
});

test('army command targets only regular troops and leaves militia autonomous', () => {
  const { engine, militia } = deployBlueMilitia();
  const before = militia.map((u) => ({ id: u.id, order: u.order }));
  const result = engine.command('blue', { type: 'army', fraction: 'all', x: 600, y: 540, attack: true } as never);
  assert.equal(result.ok, true);
  for (const item of before) {
    const current = engine.state.units.find((u) => u.id === item.id)!;
    assert.deepEqual(current.order, item.order, 'militia order is not overwritten by army command');
  }
});

test('village destruction promotes surviving militia into regular soldiers', () => {
  const { engine, village, attacker, militia } = deployBlueMilitia();
  attacker.hp = 0;
  for (const unit of militia) unit.hp = 60;
  const oldIds = new Set(militia.map((u) => u.id));
  village.hp = 0;
  run(engine, GAME_RULES.tickMs);

  assert.equal(engine.state.buildings.some((b) => b.id === village.id), false);
  assert.equal(engine.state.units.filter((u) => oldIds.has(u.id)).length, 0, 'promotion creates fresh regular-unit ids');
  const promoted = engine.armyOf('blue').filter((u) => ![1, 2, 3].includes(u.id));
  assert.ok(promoted.some((u) => u.type === 'soldier' && u.maxHp === UNIT_STATS.soldier.hp && u.hp === 60));
});

test('if a village falls and militia survive, the survivors become controllable', () => {
  const { engine, village, attacker, militia } = deployBlueMilitia();
  attacker.hp = 0;
  militia[0].hp = 70;
  militia[1].hp = 0;
  militia[2].hp = 0;
  village.hp = 0;
  run(engine, GAME_RULES.tickMs);

  const survivor = engine.armyOf('blue').find((u) => u.hp === 70);
  assert.ok(survivor && survivor.type === 'soldier');
  const result = engine.command('blue', { type: 'move', unitIds: [survivor.id], x: 650, y: 540, attack: false });
  assert.equal(result.ok, true, 'promoted militia can receive regular orders');
});

test('simultaneous village and militia death leaves no converted survivor', () => {
  const { engine, village, militia } = deployBlueMilitia();
  for (const unit of militia) unit.hp = 0;
  village.hp = 0;
  run(engine, GAME_RULES.tickMs);

  assert.equal(engine.state.buildings.some((b) => b.id === village.id), false);
  assert.equal(engine.state.units.some((u) => u.type === 'militia' && u.garrisonVillageId === village.id), false);
});

test('a wiped militia garrison permanently leaves the village without defenders', () => {
  const { engine, village, attacker, militia } = deployBlueMilitia();
  for (const unit of militia) unit.hp = 0;
  run(engine, GAME_RULES.tickMs);
  assert.equal(engine.state.units.some((u) => u.type === 'militia' && u.garrisonVillageId === village.id), false);

  const secondAttacker = engine.armyOf('red').find((u) => u.id !== attacker.id)!;
  secondAttacker.x = village.x + BUILDING_STATS.village.halfWidth + GAME_RULES.militia.triggerRange - 8;
  secondAttacker.y = village.y;
  run(engine, GAME_RULES.tickMs);

  assert.equal(engine.state.units.some((u) => u.type === 'militia' && u.garrisonVillageId === village.id), false);
});

test('surviving militia withdraw to the village and the garrison can respond again later', () => {
  const { engine, village, attacker, militia } = deployBlueMilitia();
  attacker.hp = 0;
  run(engine, 1500);
  assert.equal(engine.state.units.some((u) => u.type === 'militia' && u.garrisonVillageId === village.id), false);

  const nextAttacker = engine.armyOf('red')[0];
  nextAttacker.x = village.x + BUILDING_STATS.village.halfWidth + GAME_RULES.militia.triggerRange - 8;
  nextAttacker.y = village.y;
  run(engine, GAME_RULES.tickMs);
  assert.equal(engine.state.units.filter((u) => u.type === 'militia' && u.garrisonVillageId === village.id).length, GAME_RULES.militia.count);
});
