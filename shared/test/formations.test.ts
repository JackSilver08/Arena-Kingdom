import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FORMATION_STATS, FORMATION_TYPES, formationOffsets } from '../src/index.js';
import type { FormationType } from '../src/index.js';

function mean(points: { x: number; y: number }[]) {
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length
  };
}

test('all supported formations produce one offset per troop and stay centred', () => {
  for (const formation of FORMATION_TYPES) {
    const offsets = formationOffsets(17, formation);
    assert.equal(offsets.length, 17, `${formation} should preserve troop count`);
    const centre = mean(offsets);
    assert.ok(Math.abs(centre.x) < 0.01, `${formation} x-centre`);
    assert.ok(Math.abs(centre.y) < 0.01, `${formation} y-centre`);
  }
});

test('line is wider than it is deep and column is deep rather than wide', () => {
  const line = formationOffsets(8, 'line');
  const column = formationOffsets(8, 'column');
  const span = (points: { x: number; y: number }[]) => ({
    x: Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)),
    y: Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y))
  });
  const lineSpan = span(line);
  const columnSpan = span(column);
  assert.ok(lineSpan.x > lineSpan.y, 'line should be broad');
  assert.ok(columnSpan.y > columnSpan.x, 'column should be deep');
});

test('wedge exposes a forward point and square forms a compact grid', () => {
  const wedge = formationOffsets(7, 'wedge');
  assert.ok(wedge.some((p) => p.x > 0 && p.y > 0));
  assert.ok(wedge.some((p) => p.x < 0 && p.y > 0));
  assert.ok(wedge.some((p) => Math.abs(p.x) < 0.01 && p.y < 0));

  const square = formationOffsets(9, 'square');
  const xs = new Set(square.map((p) => p.x));
  const ys = new Set(square.map((p) => p.y));
  assert.equal(xs.size, 3);
  assert.equal(ys.size, 3);
});

test('formation modifiers remain within the intended gameplay envelope', () => {
  const expected: Record<FormationType, [number, number, number]> = {
    line: [1.1, 1.05, 0.95],
    column: [1, 0.98, 1.12],
    wedge: [1.15, 0.95, 1.05],
    square: [0.9, 1.18, 0.85]
  };
  for (const formation of FORMATION_TYPES) {
    const actual = FORMATION_STATS[formation];
    assert.deepEqual([actual.attackMultiplier, actual.defenseMultiplier, actual.speedMultiplier], expected[formation]);
  }
});
