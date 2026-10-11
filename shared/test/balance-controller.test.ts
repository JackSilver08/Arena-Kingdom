import assert from 'node:assert/strict';
import { test } from 'node:test';
import { StrategyController, type StrategyProfile } from '../scripts/balance.js';
import { MatchEngine, SIDES, opponentOf, startingLayout } from '../src/index.js';

const profile: StrategyProfile = {
  attackAtMs: 0, attackArmy: 1, formation: 'line', targets: {}, buildOrder: [],
  reserveGold: 999_999, defendFraction: 1
};

test('balance controller starts a blind attack-move toward public spawn without reading a hidden castle position', () => {
  for (const side of SIDES) {
    const engine = new MatchEngine();
    const enemy = opponentOf(side);
    const castle = engine.castleOf(enemy)!;
    castle.x = side === 'blue' ? 1800 : 120;
    castle.y = 650;
    const controller = new StrategyController(side, profile);
    controller.update(engine, 50);
    const publicSpawn = startingLayout(enemy).buildings.find((b) => b.type === 'castle')!;
    const orders = engine.armyOf(side).map((u) => u.order);
    assert.ok(orders.every((order) => order.kind === 'move'), `${side} should advance without a hidden target ID`);
    const destinations = orders.filter((order) => order.kind === 'move');
    assert.ok(Math.abs(destinations.reduce((sum, order) => sum + order.x, 0) / destinations.length - publicSpawn.x) < 1e-9);
    assert.ok(Math.abs(destinations.reduce((sum, order) => sum + order.y, 0) / destinations.length - publicSpawn.y) < 1e-9);
    assert.equal(controller.metrics.firstAttackMs, 50);
  }
});

test('balance controller attacks a revealed building with an accepted explicit order', () => {
  for (const side of SIDES) {
    const engine = new MatchEngine();
    const enemy = opponentOf(side);
    const target = engine.buildingsOf(enemy, 'barracks')[0];
    engine.armyOf(side).forEach((unit, i) => {
      unit.x = target.x + (side === 'blue' ? -100 : 100);
      unit.y = target.y + i * 24;
    });
    const controller = new StrategyController(side, profile);
    controller.update(engine, 50);
    assert.ok(engine.armyOf(side).every((u) => u.order.kind === 'attack' && u.order.targetId === target.id));
  }
});
