import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BUILDING_STATS,
  BotController,
  GAME_RULES,
  MatchEngine,
  NavGrid,
  UNIT_STATS,
  decodeSnapshot,
  encodeSnapshot,
  parseCommand,
  snapPlacement,
  territoryBounds
} from '../src/index.js';

function run(engine: MatchEngine, ms: number) {
  for (let t = 0; t < ms; t += GAME_RULES.tickMs) engine.update(GAME_RULES.tickMs);
}

test('starting kingdoms are mirrored', () => {
  const engine = new MatchEngine();
  assert.equal(engine.buildingsOf('blue').length, engine.buildingsOf('red').length);
  assert.equal(engine.armyOf('blue').length, engine.armyOf('red').length);
  const blue = engine.castleOf('blue')!;
  const red = engine.castleOf('red')!;
  assert.equal(blue.x, red.x);
  assert.equal(blue.y + red.y, GAME_RULES.map.midlineY * 2);
  assert.ok(blue.y < red.y, 'blue rules the top half');
  assert.equal(engine.state.players.blue.gold, GAME_RULES.economy.startingGold);
});

test('villages generate income on the interval', () => {
  const engine = new MatchEngine();
  const { income, gold } = engine.state.players.blue;
  assert.equal(income, GAME_RULES.economy.castleIncome + 3 * GAME_RULES.economy.villageIncome);
  run(engine, GAME_RULES.economy.incomeIntervalMs);
  assert.equal(engine.state.players.blue.gold, gold + income);
});

test('building costs gold and respects territory', () => {
  const engine = new MatchEngine();
  assert.equal(engine.command('blue', { type: 'build', building: 'village', x: 700, y: 800 }).ok, false, 'enemy territory');
  assert.equal(engine.command('blue', { type: 'build', building: 'village', x: 960, y: 240 }).ok, false, 'overlaps castle');
  assert.equal(engine.command('blue', { type: 'build', building: 'village', x: 1220, y: 440 }).ok, true);
  assert.equal(engine.state.players.blue.gold, GAME_RULES.economy.startingGold - BUILDING_STATS.village.cost);
  assert.equal(engine.buildingsOf('blue', 'village').length, 4);
});

test('barracks train queued soldiers', () => {
  const engine = new MatchEngine();
  assert.equal(engine.command('blue', { type: 'train', count: 2 }).ok, true);
  assert.equal(engine.state.players.blue.gold, GAME_RULES.economy.startingGold - 2 * UNIT_STATS.soldier.cost);
  const before = engine.armyOf('blue').length;
  run(engine, UNIT_STATS.soldier.trainMs * 2 + 100);
  assert.equal(engine.armyOf('blue').length, before + 2);
  assert.equal(engine.state.players.blue.stats.unitsTrained, 2);
});

test('soldiers fight and destroying the castle ends the match', () => {
  const engine = new MatchEngine();
  const castle = engine.castleOf('red')!;
  // Remove the red defenders and weaken the castle so the siege resolves deterministically.
  for (const unit of engine.armyOf('red')) unit.hp = 0;
  castle.hp = 300;
  engine.command('blue', { type: 'army', fraction: 'all', x: castle.x, y: castle.y, targetId: castle.id });
  run(engine, 120_000);
  assert.ok(engine.state.result, 'match should end');
  assert.equal(engine.state.result.winner, 'blue');
  assert.equal(engine.state.result.reason, 'castle');
});

test('fence segments snap together and block only the enemy', () => {
  const engine = new MatchEngine();
  engine.state.players.blue.gold = 1000;
  const y = territoryBounds('blue', BUILDING_STATS.fence.halfWidth + 8, BUILDING_STATS.fence.halfHeight + 8).maxY;
  assert.equal(engine.command('blue', { type: 'build', building: 'fence', x: 960, y }).ok, true);
  const snapped = snapPlacement(engine.state.buildings, 'blue', 'fence', 960 + BUILDING_STATS.fence.halfWidth * 2 + 20, y + 6);
  assert.deepEqual(snapped, { x: 960 + BUILDING_STATS.fence.halfWidth * 2, y });
  assert.equal(engine.command('blue', { type: 'build', building: 'fence', x: snapped.x, y: snapped.y }).ok, true);

  const nav = new NavGrid();
  nav.rebuild(engine.state.buildings);
  assert.ok(nav.firstWall('red', 1000, 700, 1000, 300), 'red troops are blocked by the blue wall');
  assert.equal(nav.firstWall('blue', 1000, 300, 1000, 700), null, 'blue troops walk through their own wall');
  const path = nav.findPath('red', { x: 1000, y: 700 }, { x: 1000, y: 300 });
  assert.ok(path, 'red can walk around the wall');
  assert.ok(path.points.length >= 2, 'the route bends around the fence');
});

test('troops break through a wall that seals the island', () => {
  const engine = new MatchEngine();
  engine.state.players.blue.gold = 10_000;
  const { halfWidth, halfHeight } = BUILDING_STATS.fence;
  const bounds = territoryBounds('blue', halfWidth + 8, halfHeight + 8);
  const build = (x: number, y: number) => assert.equal(engine.command('blue', { type: 'build', building: 'fence', x, y }).ok, true);
  for (let x = bounds.minX; x <= bounds.maxX; x += halfWidth * 2) build(x, bounds.maxY);
  // A second row closes the gap left at the right edge.
  build(bounds.maxX, bounds.maxY - 40);

  const nav = new NavGrid();
  nav.rebuild(engine.state.buildings);
  const castle = engine.castleOf('blue')!;
  assert.equal(nav.findPath('red', { x: 960, y: 700 }, { x: castle.x, y: castle.y + 70 }), null, 'no way around');

  for (const unit of engine.armyOf('blue')) unit.hp = 0;
  engine.command('red', { type: 'army', fraction: 'all', x: castle.x, y: castle.y + 70 });
  const fencesBefore = engine.buildingsOf('blue', 'fence').length;
  run(engine, 60_000);
  assert.ok(engine.buildingsOf('blue', 'fence').length < fencesBefore, 'a fence was destroyed');
  assert.ok(engine.armyOf('red').some((u) => u.y < bounds.maxY - halfHeight), 'troops got through the gap');
});

test('an explicit attack order focuses the chosen target', () => {
  const engine = new MatchEngine();
  const village = engine.buildingsOf('red', 'village')[0];
  for (const unit of engine.armyOf('red')) unit.hp = 0;
  const ids = engine.armyOf('blue').map((u) => u.id);
  assert.equal(engine.command('blue', { type: 'move', unitIds: ids, x: 0, y: 0, attack: true, targetId: village.id }).ok, true);
  run(engine, 60_000);
  assert.ok(!engine.state.buildings.some((b) => b.id === village.id), 'the targeted village fell');
});

test('peace requires the opponent to accept', () => {
  const engine = new MatchEngine();
  assert.equal(engine.command('blue', { type: 'proposePeace' }).ok, true);
  assert.equal(engine.command('blue', { type: 'respondPeace', accept: true }).ok, false);
  assert.equal(engine.command('red', { type: 'respondPeace', accept: true }).ok, true);
  assert.equal(engine.state.result?.winner, null);
  assert.equal(engine.state.result?.reason, 'peace');
});

test('surrender hands the win to the opponent', () => {
  const engine = new MatchEngine();
  engine.command('red', { type: 'surrender' });
  assert.equal(engine.state.result?.winner, 'blue');
});

test('snapshots round-trip through the wire format', () => {
  const engine = new MatchEngine();
  engine.command('blue', { type: 'train', count: 1 });
  run(engine, 3000);
  const { view } = decodeSnapshot(JSON.parse(JSON.stringify(encodeSnapshot(engine.state, []))));
  assert.equal(view.units.length, engine.state.units.length);
  assert.equal(view.buildings.length, engine.state.buildings.length);
  assert.equal(view.players.blue.gold, engine.state.players.blue.gold);
  assert.equal(view.buildings[0].type, engine.state.buildings[0].type);
  assert.equal(view.units.at(-1)!.side, engine.state.units.at(-1)!.side);
});

test('parseCommand rejects malformed input', () => {
  assert.equal(parseCommand({ type: 'build', building: 'castle', x: 1, y: 1 }), null);
  assert.equal(parseCommand({ type: 'move', unitIds: ['1'], x: 1, y: 1 }), null);
  assert.equal(parseCommand({ type: 'build', building: 'tower', x: Infinity, y: 1 }), null);
  assert.equal(parseCommand('surrender'), null);
  assert.equal(parseCommand({ type: 'move', unitIds: [1], x: 1, y: 1, targetId: 'x' }), null);
  assert.deepEqual(parseCommand({ type: 'surrender' }), { type: 'surrender' });
});

test('bots finish a match without corrupting state', () => {
  const engine = new MatchEngine();
  const bots = [new BotController('blue', 'hard'), new BotController('red', 'easy')];
  while (!engine.ended) {
    for (const bot of bots) bot.update(engine, GAME_RULES.tickMs);
    engine.update(GAME_RULES.tickMs);
    engine.drainEvents();
    for (const u of engine.state.units) assert.ok(Number.isFinite(u.x) && Number.isFinite(u.y));
  }
  assert.ok(engine.state.result);
});
