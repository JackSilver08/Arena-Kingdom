import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MatchEngine, UNIT_STATS, decodeSnapshot, encodeSnapshot } from '../src/index.js';

function run(engine: MatchEngine, ms: number) {
  for (let elapsed = 0; elapsed < ms; elapsed += 250) {
    engine.update(Math.min(250, ms - elapsed));
  }
}

test('Cannon uses the approved siege baseline', () => {
  assert.equal(UNIT_STATS.cannon.cost, 100);
  assert.equal(UNIT_STATS.cannon.trainMs, 8000);
  assert.equal(UNIT_STATS.cannon.hp, 180);
  assert.equal(UNIT_STATS.cannon.attack.damage, 80);
  assert.equal(UNIT_STATS.cannon.buildingAttack?.damage, 120);
  assert.equal(UNIT_STATS.cannon.attack.range, 360);
  assert.equal(UNIT_STATS.archer.attack.range, 190);
  assert.equal(UNIT_STATS.cannon.splashRadius, 42);
});

test('Cannon is recruited from a Barracks for 100 gold', () => {
  const engine = new MatchEngine();
  const barracks = engine.buildingsOf('blue', 'barracks')[0];
  engine.state.players.blue.gold = 1000;
  const before = engine.armyOf('blue').length;

  const queued = engine.command('blue', {
    type: 'train',
    barracksId: barracks.id,
    unitType: 'cannon'
  });

  assert.equal(queued.ok, true);
  assert.equal(engine.state.players.blue.gold, 900);
  assert.equal(barracks.trainType, 'cannon');
  assert.equal(barracks.queue, 1);

  run(engine, 8000);

  assert.ok(engine.armyOf('blue').some((u) => u.type === 'cannon'));
  assert.equal(engine.armyOf('blue').length, before + 1);
});

test('Cannon splash damage hits nearby enemies with falloff', () => {
  const engine = new MatchEngine();
  const barracks = engine.buildingsOf('blue', 'barracks')[0];
  engine.state.players.blue.gold = 1000;

  assert.equal(engine.command('blue', {
    type: 'train',
    barracksId: barracks.id,
    unitType: 'cannon'
  }).ok, true);

  run(engine, 8000);

  const cannon = engine.armyOf('blue').find((u) => u.type === 'cannon')!;
  const redUnits = engine.armyOf('red');
  const primary = redUnits[0];
  const splash = redUnits[1];
  assert.ok(cannon && primary && splash);

  for (const unit of engine.armyOf('blue')) {
    if (unit.id !== cannon.id) unit.hp = 0;
  }
  for (const unit of redUnits) {
    if (unit.id !== primary.id && unit.id !== splash.id) unit.hp = 0;
  }

  primary.type = 'scout';
  splash.type = 'scout';
  primary.x = cannon.x + 150;
  primary.y = cannon.y;
  splash.x = cannon.x + 175;
  splash.y = cannon.y;
  primary.hp = primary.maxHp = 200;
  splash.hp = splash.maxHp = 200;

  run(engine, 3500);

  assert.ok(primary.hp <= 120, 'the primary target should take at least the configured 80 direct damage');
  assert.ok(primary.hp > 0, 'the primary target should survive the first isolated shot');
  assert.ok(splash.hp < 200, 'nearby enemy should receive splash damage');
  assert.ok(splash.hp > primary.hp, 'splash damage should be weaker than direct damage');
});

test('Cannon keeps its unit type in the existing snapshot wire format', () => {
  const engine = new MatchEngine();
  const barracks = engine.buildingsOf('blue', 'barracks')[0];
  engine.state.players.blue.gold = 1000;

  assert.equal(engine.command('blue', {
    type: 'train',
    barracksId: barracks.id,
    unitType: 'cannon'
  }).ok, true);

  run(engine, 8000);

  const encoded = encodeSnapshot(engine.state, []);
  const decoded = decodeSnapshot(JSON.parse(JSON.stringify(encoded))).view;

  assert.ok(decoded.units.some((u) => u.type === 'cannon'));
  assert.equal(encoded.u.length % 6, 0);
});

test('Cannon can use its dedicated building damage', () => {
  const engine = new MatchEngine();
  const barracks = engine.buildingsOf('blue', 'barracks')[0];
  engine.state.players.blue.gold = 1000;

  assert.equal(engine.command('blue', {
    type: 'train',
    barracksId: barracks.id,
    unitType: 'cannon'
  }).ok, true);

  run(engine, 8000);

  const cannon = engine.armyOf('blue').find((u) => u.type === 'cannon')!;
  assert.ok(cannon);

  for (const unit of engine.armyOf('blue')) {
    if (unit.id !== cannon.id) unit.hp = 0;
  }
  for (const unit of engine.armyOf('red')) unit.hp = 0;

  const target = engine.buildingsOf('red', 'barracks')[0];
  cannon.x = target.x - 300;
  cannon.y = target.y;
  cannon.order = { kind: 'idle' };

  const before = target.hp;
  run(engine, 3500);

  assert.equal(target.hp, before - UNIT_STATS.cannon.buildingAttack!.damage);
});
