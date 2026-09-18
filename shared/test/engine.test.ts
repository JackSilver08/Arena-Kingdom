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
  isWalkableLand,
  islandSpanY,
  parseCommand,
  snapPlacement
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
  assert.equal(blue.y, red.y);
  assert.equal(blue.x + red.x, GAME_RULES.map.midlineX * 2);
  assert.ok(blue.x < red.x, 'blue rules the left half');
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
  assert.equal(engine.command('blue', { type: 'build', building: 'village', x: 1300, y: 540 }).ok, false, 'enemy territory');
  assert.equal(engine.command('blue', { type: 'build', building: 'village', x: GAME_RULES.map.midlineX, y: 540 }).ok, false, 'neutral strip');
  assert.equal(engine.command('blue', { type: 'build', building: 'village', x: 300, y: 540 }).ok, false, 'overlaps castle');
  assert.equal(engine.command('blue', { type: 'build', building: 'village', x: 700, y: 820 }).ok, true);
  assert.equal(engine.state.players.blue.gold, GAME_RULES.economy.startingGold - BUILDING_STATS.village.cost);
  assert.equal(engine.buildingsOf('blue', 'village').length, 4);

  engine.state.players.blue.gold = 1000;
  const shore = islandSpanY(400, BUILDING_STATS.village.halfWidth + 8)!;
  assert.ok(shore.minY < 150, 'the island reaches past the old building rectangle');
  assert.equal(engine.command('blue', { type: 'build', building: 'village', x: 400, y: shore.minY + 2 }).ok, true, 'build near the shore');
  assert.equal(engine.command('blue', { type: 'build', building: 'village', x: 400, y: shore.minY - 20 }).ok, false, 'not on the beach');
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

test('unit roster keeps the intended 18 / 21 / 24 gold balance', () => {
  assert.equal(UNIT_STATS.soldier.cost, 18);
  assert.equal(UNIT_STATS.archer.cost, 21);
  assert.equal(UNIT_STATS.knight.cost, 24);
  assert.equal(UNIT_STATS.knight.speed, UNIT_STATS.soldier.speed * 3);
  assert.ok(UNIT_STATS.archer.attack.range > UNIT_STATS.soldier.attack.range);
  assert.equal(UNIT_STATS.archer.buildingAttack?.range, 125);
});

test('barracks train archers and knights with typed queues', () => {
  const engine = new MatchEngine();
  engine.state.players.blue.gold = 1000;

  assert.equal(engine.command('blue', { type: 'train', count: 2, unitType: 'archer' }).ok, true);
  assert.equal(engine.state.players.blue.gold, 1000 - 2 * UNIT_STATS.archer.cost);
  const barracks = engine.buildingsOf('blue', 'barracks')[0];
  assert.equal(barracks.trainType, 'archer');
  run(engine, UNIT_STATS.archer.trainMs * 2 + 100);
  assert.equal(engine.armyOf('blue').filter((u) => u.type === 'archer').length, 2);
  assert.equal(barracks.queue, 0);
  assert.equal(barracks.trainType, null);

  assert.equal(engine.command('blue', { type: 'train', count: 1, unitType: 'knight' }).ok, true);
  assert.equal(engine.state.players.blue.gold, 1000 - 2 * UNIT_STATS.archer.cost - UNIT_STATS.knight.cost);
  assert.equal(barracks.trainType, 'knight');
  run(engine, UNIT_STATS.knight.trainMs + 100);
  assert.equal(engine.armyOf('blue').filter((u) => u.type === 'knight').length, 1);
});

test('archers can hit buildings from their dedicated shorter building range', () => {
  const engine = new MatchEngine();
  const archer = engine.armyOf('blue')[0];
  archer.type = 'archer';
  archer.hp = UNIT_STATS.archer.hp;
  archer.maxHp = UNIT_STATS.archer.hp;
  const village = engine.buildingsOf('red', 'village')[0];
  for (const unit of engine.armyOf('red')) unit.hp = 0;
  archer.x = village.x - 155;
  archer.y = village.y;
  archer.order = { kind: 'idle' };
  const before = village.hp;
  engine.command('blue', { type: 'move', unitIds: [archer.id], x: village.x, y: village.y, attack: true, targetId: village.id });
  run(engine, UNIT_STATS.archer.attack.cooldownMs + 250);
  assert.ok(village.hp < before, 'archer should damage a building inside building range');
});
 
test('soldiers fight and destroying the castle ends the match', () => {
  const engine = new MatchEngine();
  const castle = engine.castleOf('red')!;
  // This is a focused castle-combat test. Remove enemy villages so village militia is not part of this case.
  engine.state.buildings = engine.state.buildings.filter((b) => !(b.side === 'red' && b.type === 'village'));
  // Remove the red defenders and weaken the castle so the siege resolves deterministically.
  for (const unit of engine.armyOf('red')) unit.hp = 0;
  castle.hp = 300;
  engine.command('blue', { type: 'army', fraction: 'all', x: castle.x, y: castle.y, targetId: castle.id });
  run(engine, 120_000);
  assert.ok(engine.state.result, 'match should end');
  assert.equal(engine.state.result.winner, 'blue');
  assert.equal(engine.state.result.reason, 'castle');
});

test('fence segments stand vertically, snap together and block only the enemy', () => {
  const engine = new MatchEngine();
  engine.state.players.blue.gold = 1000;
  const { halfWidth, halfHeight } = BUILDING_STATS.fence;
  assert.ok(halfHeight > halfWidth, 'fences run north-south');
  assert.equal(engine.command('blue', { type: 'build', building: 'fence', x: 600, y: 540 }).ok, true);
  const snapped = snapPlacement(engine.state.buildings, 'blue', 'fence', 606, 540 + halfHeight * 2 + 20);
  assert.deepEqual(snapped, { x: 600, y: 540 + halfHeight * 2 });
  assert.equal(engine.command('blue', { type: 'build', building: 'fence', x: snapped.x, y: snapped.y }).ok, true);

  const nav = new NavGrid();
  nav.rebuild(engine.state.buildings);
  assert.ok(nav.firstWall('red', 660, 560, 540, 560), 'red troops are blocked by the blue wall');
  assert.equal(nav.firstWall('blue', 540, 560, 660, 560), null, 'blue troops walk through their own wall');
  const path = nav.findPath('red', { x: 660, y: 560 }, { x: 540, y: 560 });
  assert.ok(path, 'red can walk around the wall');
  assert.ok(path.points.length >= 2, 'the route bends around the fence');
});

test('fences reach the shore, seal the front line and troops break through', () => {
  const engine = new MatchEngine();
  engine.state.players.blue.gold = 10_000;
  const { halfWidth, halfHeight } = BUILDING_STATS.fence;
  const x = GAME_RULES.map.blueLand.maxX - halfWidth - 8;
  const shore = islandSpanY(x)!;
  assert.equal(engine.command('blue', { type: 'build', building: 'fence', x, y: shore.minY - halfHeight - 10 }).ok, false, 'not in the sea');
  // Chain snapped fences down from the top shore until the next one would be entirely in the sea.
  const ys: number[] = [];
  for (let y = shore.minY + 2; engine.command('blue', { type: 'build', building: 'fence', x, y }).ok; y += halfHeight * 2) ys.push(y);
  assert.ok(!isWalkableLand(x, ys[0] - halfHeight), 'the top fence runs past the shore');
  assert.ok(ys[ys.length - 1] + halfHeight >= shore.maxY - 8, 'the chain reaches the far shore');

  const nav = new NavGrid();
  nav.rebuild(engine.state.buildings);
  const castle = engine.castleOf('blue')!;
  const red = engine.castleOf('red')!;
  assert.equal(nav.findPath('red', { x: red.x - 100, y: red.y }, { x: castle.x + 70, y: castle.y }), null, 'no way around');

  for (const unit of engine.armyOf('blue')) unit.hp = 0;
  // Remove red villages for this pathing-only assertion so autonomous garrisons cannot interfere with the route.
  engine.state.buildings = engine.state.buildings.filter((b) => !(b.side === 'red' && b.type === 'village'));
  engine.command('red', { type: 'army', fraction: 'all', x: castle.x + 70, y: castle.y });
  const fencesBefore = engine.buildingsOf('blue', 'fence').length;
  run(engine, 60_000);
  assert.ok(engine.buildingsOf('blue', 'fence').length < fencesBefore, 'a fence was destroyed');
  assert.ok(engine.armyOf('red').some((u) => u.x < x - halfWidth), 'troops got through the gap');
});

test('an explicit attack order focuses the chosen target', () => {
  const engine = new MatchEngine();
  const village = engine.buildingsOf('red', 'village')[0];
  // Keep the target village, but station the three regular defenders beside it so the militia trigger is not needed.
  const defenders = engine.armyOf('red');
  defenders.forEach((unit, index) => {
    unit.x = village.x + BUILDING_STATS.village.halfWidth + 18;
    unit.y = village.y + (index - 1) * 24;
    unit.order = { kind: 'idle' };
  });
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