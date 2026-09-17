import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FORMATION_TYPES, MatchEngine } from '../src/index.js';

test('army commands assign the requested formation to every selected troop', () => {
  for (const formation of FORMATION_TYPES) {
    const engine = new MatchEngine();
    const result = engine.command('blue', {
      type: 'army',
      fraction: 'all',
      x: 800,
      y: 540,
      formation
    });
    assert.equal(result.ok, true, `${formation} command should be accepted`);
    const units = engine.armyOf('blue');
    assert.equal(units.length, 3);
    assert.ok(units.every((unit) => unit.formation === formation));
  }
});

test('formation order changes the destination geometry without changing troop count', () => {
  const lineEngine = new MatchEngine();
  const wedgeEngine = new MatchEngine();

  lineEngine.command('blue', { type: 'army', fraction: 'all', x: 820, y: 540, formation: 'line' });
  wedgeEngine.command('blue', { type: 'army', fraction: 'all', x: 820, y: 540, formation: 'wedge' });

  const line = lineEngine.armyOf('blue').map((u) => ({ x: u.order.kind === 'move' ? u.order.x : u.x, y: u.order.kind === 'move' ? u.order.y : u.y }));
  const wedge = wedgeEngine.armyOf('blue').map((u) => ({ x: u.order.kind === 'move' ? u.order.x : u.x, y: u.order.kind === 'move' ? u.order.y : u.y }));

  assert.equal(line.length, wedge.length);
  assert.notDeepEqual(line, wedge, 'different formations should produce different movement goals');
});
