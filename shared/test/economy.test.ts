import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BUILDING_STATS,
  GAME_RULES,
  MatchEngine,
  armySupplyCapacity,
  armyUpkeep
} from '../src/index.js';

function run(engine: MatchEngine, ms: number) {
  for (let t = 0; t < ms; t += GAME_RULES.tickMs) engine.update(GAME_RULES.tickMs);
}

test('starting kingdom supply leaves the opening army maintenance-free', () => {
  const engine = new MatchEngine();
  const capacity = armySupplyCapacity(engine.buildingsOf('blue'));
  const expectedStartingSupply = GAME_RULES.economy.supply.castle + 3 * GAME_RULES.economy.supply.village + GAME_RULES.economy.supply.barracks;
  assert.equal(capacity, expectedStartingSupply);
  assert.equal(capacity, 12);
  assert.equal(engine.armyOf('blue').length, 3);
  assert.equal(armyUpkeep(engine.armyOf('blue').length, capacity), 0);
});

test('villages increase both income and military supply', () => {
  const engine = new MatchEngine();
  const beforeSupply = armySupplyCapacity(engine.buildingsOf('blue'));
  const beforeIncome = engine.state.players.blue.income;
  engine.state.players.blue.gold = 1000;

  assert.equal(engine.command('blue', { type: 'build', building: 'village', x: 700, y: 820 }).ok, true);
  assert.equal(armySupplyCapacity(engine.buildingsOf('blue')), beforeSupply + GAME_RULES.economy.supply.village);
  assert.equal(engine.state.players.blue.income, beforeIncome + GAME_RULES.economy.villageIncome);
  assert.equal(BUILDING_STATS.village.cost, 70);
});

test('army upkeep charges only troops above supply and never creates debt', () => {
  const engine = new MatchEngine();
  const capacity = armySupplyCapacity(engine.buildingsOf('blue'));
  const template = engine.armyOf('blue')[0];
  for (let i = 0; i < 25; i += 1) {
    engine.state.units.push({
      ...template,
      id: 1000 + i,
      x: 600 + (i % 5) * 22,
      y: 220 + Math.floor(i / 5) * 22,
      prevX: 600 + (i % 5) * 22,
      prevY: 220 + Math.floor(i / 5) * 22,
      order: { kind: 'idle' },
      path: null,
      pathGoal: null,
      targetId: null,
      blockerId: null,
      blockedFor: -1,
      blockedUntil: 0
    });
  }

  const army = engine.armyOf('blue').length;
  assert.equal(army, 28);
  assert.equal(armyUpkeep(army, capacity), 16);

  engine.state.players.blue.gold = 0;
  run(engine, GAME_RULES.economy.incomeIntervalMs);
  assert.equal(engine.state.players.blue.gold, engine.state.players.blue.income - 16);
  assert.equal(engine.state.players.blue.stats.goldSpent, 16);

  engine.state.players.blue.gold = 1;
  run(engine, GAME_RULES.economy.incomeIntervalMs);
  assert.ok(engine.state.players.blue.gold >= 0, 'upkeep must never create negative gold');
});

test('upkeep starts when a rush-sized army pushes beyond the tightened starting supply', () => {
  const engine = new MatchEngine();
  const capacity = armySupplyCapacity(engine.buildingsOf('blue'));
  assert.equal(capacity, 12);
  assert.equal(armyUpkeep(12, capacity), 0);
  assert.equal(armyUpkeep(15, capacity), 3);
  assert.equal(armyUpkeep(16, capacity), 4);
  assert.equal(armyUpkeep(18, capacity), 6);
});

test('destroying a barracks removes its supply capacity', () => {
  const engine = new MatchEngine();
  const before = armySupplyCapacity(engine.buildingsOf('blue'));
  const barracks = engine.buildingsOf('blue', 'barracks')[0];
  barracks.hp = 0;
  run(engine, GAME_RULES.tickMs);
  assert.equal(armySupplyCapacity(engine.buildingsOf('blue')), before - GAME_RULES.economy.supply.barracks);
});
