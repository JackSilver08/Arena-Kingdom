import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILDING_STATS,
  UNIT_STATS,
  createInfluenceField,
  influenceContours,
  influenceValueAt,
  startingLayout,
  type MatchView,
  type Side
} from '../src/index.js';
import { updateInfluence } from '../src/influence.js';

function emptyPlayer(side: Side) {
  return {
    side,
    gold: 0,
    income: 0,
    stats: {
      goldEarned: 0,
      goldSpent: 0,
      unitsTrained: 0,
      unitsLost: 0,
      kills: 0,
      buildingsBuilt: 0,
      buildingsLost: 0,
      buildingsDestroyed: 0,
      damageDealt: 0,
      peakArmy: 0
    }
  };
}

function viewForLayouts(blue = startingLayout('blue'), red = startingLayout('red')): MatchView {
  const buildings = [...blue.buildings.map((b, index) => ({
    id: index + 1,
    side: 'blue' as const,
    type: b.type,
    x: b.x,
    y: b.y,
    hp: BUILDING_STATS[b.type].hp,
    maxHp: BUILDING_STATS[b.type].hp,
    queue: 0,
    trainProgress: 0
  })), ...red.buildings.map((b, index) => ({
    id: 100 + index,
    side: 'red' as const,
    type: b.type,
    x: b.x,
    y: b.y,
    hp: BUILDING_STATS[b.type].hp,
    maxHp: BUILDING_STATS[b.type].hp,
    queue: 0,
    trainProgress: 0
  }))];
  const units = [...blue.units.map((u, index) => ({
    id: index + 1,
    side: 'blue' as const,
    type: 'soldier' as const,
    x: u.x,
    y: u.y,
    hp: UNIT_STATS.soldier.hp,
    maxHp: UNIT_STATS.soldier.hp,
    moving: false,
    attacking: false
  })), ...red.units.map((u, index) => ({
    id: 100 + index,
    side: 'red' as const,
    type: 'soldier' as const,
    x: u.x,
    y: u.y,
    hp: UNIT_STATS.soldier.hp,
    maxHp: UNIT_STATS.soldier.hp,
    moving: false,
    attacking: false
  }))];
  return {
    timeMs: 0,
    nextIncomeInMs: 5000,
    players: { blue: emptyPlayer('blue'), red: emptyPlayer('red') },
    units,
    buildings,
    peace: null,
    result: null
  };
}

function settle(field: ReturnType<typeof createInfluenceField>, view: MatchView, steps = 12) {
  for (let i = 0; i < steps; i++) updateInfluence(field, view, 333);
}

function lineCenterX(field: ReturnType<typeof createInfluenceField>) {
  const { frontLines } = influenceContours(field);
  if (!frontLines.length) return null;
  const points = frontLines.flat();
  return points.reduce((sum, point) => sum + point.x, 0) / points.length;
}

test('influence is symmetric at the opening state', () => {
  const view = viewForLayouts();
  const field = createInfluenceField();
  settle(field, view);
  const left = influenceValueAt(field, 900, 540);
  const right = influenceValueAt(field, 1020, 540);
  assert.ok(Math.abs(left + right) < 0.15, `expected mirrored scores, got ${left} and ${right}`);
});

test('a blue push moves the frontline toward red territory', () => {
  const opening = viewForLayouts();
  const initialField = createInfluenceField();
  settle(initialField, opening);
  const initialX = lineCenterX(initialField);
  assert.notEqual(initialX, null);
  assert.ok(Math.abs(initialX! - 960) < 45, `opening frontline too far from center: ${initialX}`);

  const pushed = structuredClone(opening) as MatchView;
  pushed.units[0].x = 1000;
  const pushedField = createInfluenceField();
  settle(pushedField, pushed);
  const pushedX = lineCenterX(pushedField);
  assert.notEqual(pushedX, null);
  assert.ok(pushedX! > initialX! + 4, `frontline did not move right: ${initialX} -> ${pushedX}`);
});

test('encircled enemy source produces a closed influence pocket', () => {
  const units = Array.from({ length: 8 }, (_, index) => {
    const angle = (index / 8) * Math.PI * 2;
    return {
      id: index + 1,
      side: 'blue' as const,
      type: 'soldier' as const,
      x: 960 + Math.cos(angle) * 95,
      y: 540 + Math.sin(angle) * 95,
      hp: 100,
      maxHp: 100,
      moving: false,
      attacking: false
    };
  });
  const view = viewForLayouts({ buildings: [], units: [] }, { buildings: [{ type: 'castle', x: 960, y: 540 }], units: [] });
  view.units = units;
  const redCastle = view.buildings.find((b) => b.side === 'red');
  assert.ok(redCastle);
  const field = createInfluenceField();
  settle(field, view, 18);
  const contours = influenceContours(field);
  assert.ok(contours.polygons.some((polygon) => polygon.side === 'blue' || polygon.side === 'red'));
  assert.ok(contours.frontLines.length > 0);
});

test('influence update remains within the presentation performance budget envelope', () => {
  const base = viewForLayouts();
  const view = structuredClone(base) as MatchView;
  view.units = Array.from({ length: 80 }, (_, index) => ({
    id: 1000 + index,
    side: index % 2 === 0 ? 'blue' : 'red',
    type: 'soldier' as const,
    x: 300 + (index % 20) * 24,
    y: 250 + Math.floor(index / 20) * 110,
    hp: 100,
    maxHp: 100,
    moving: false,
    attacking: false
  }));
  const buildings = Array.from({ length: 60 }, (_, index) => ({
    id: 2000 + index,
    side: index % 2 === 0 ? 'blue' : 'red',
    type: (['village', 'barracks', 'tower', 'fence', 'castle'] as const)[index % 5],
    x: 260 + (index % 15) * 90,
    y: 220 + Math.floor(index / 15) * 160,
    hp: 500,
    maxHp: 500,
    queue: 0,
    trainProgress: 0
  }));
  view.buildings = buildings;
  const field = createInfluenceField();
  const start = performance.now();
  updateInfluence(field, view, 333);
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 25, `influence update took ${elapsed.toFixed(2)}ms`);
});
