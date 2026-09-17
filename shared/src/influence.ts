import { BUILDING_STATS, GAME_RULES } from './rules.js';
import { isWalkableLand } from './island.js';
import type { MatchView, Side, Vec2 } from './types.js';

export const INFLUENCE_CELL_SIZE = 40;
export const INFLUENCE_UPDATE_MS = 250;
export const INFLUENCE_SIGMA = 90;
export const INFLUENCE_TAU_MS = 1500;

const BUILDING_WEIGHT: Record<string, number> = {
  castle: 6,
  village: 2,
  tower: 3,
  barracks: 3,
  fence: 0.5
};

export interface InfluenceField {
  readonly cellSize: number;
  readonly originX: number;
  readonly originY: number;
  readonly cols: number;
  readonly rows: number;
  readonly land: Uint8Array;
  readonly previous: Float32Array;
  readonly current: Float32Array;
  accumulatorMs: number;
  version: number;
}

export interface InfluencePolygon {
  side: Side;
  points: Vec2[];
}

export interface InfluenceContours {
  frontLines: Vec2[][];
  polygons: InfluencePolygon[];
}

export interface InfluenceSource {
  side: Side;
  x: number;
  y: number;
  weight: number;
}

export function createInfluenceField(cellSize = INFLUENCE_CELL_SIZE): InfluenceField {
  const { island } = GAME_RULES.map;
  const cols = Math.ceil(island.width / cellSize) + 1;
  const rows = Math.ceil(island.height / cellSize) + 1;
  const land = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = island.x + col * cellSize;
      const y = island.y + row * cellSize;
      land[row * cols + col] = isWalkableLand(x, y) ? 1 : 0;
    }
  }
  return {
    cellSize,
    originX: island.x,
    originY: island.y,
    cols,
    rows,
    land,
    previous: new Float32Array(cols * rows),
    current: new Float32Array(cols * rows),
    accumulatorMs: INFLUENCE_UPDATE_MS,
    version: 0
  };
}

export function influenceSources(view: MatchView): InfluenceSource[] {
  const sources: InfluenceSource[] = [];
  for (const unit of view.units) sources.push({ side: unit.side, x: unit.x, y: unit.y, weight: 1 });
  for (const building of view.buildings) {
    sources.push({ side: building.side, x: building.x, y: building.y, weight: BUILDING_WEIGHT[building.type] ?? 1 });
  }
  return sources;
}

function sideSign(side: Side) {
  return side === 'blue' ? 1 : -1;
}

function staticBias(x: number) {
  const span = Math.max(1, GAME_RULES.map.width / 2);
  return ((GAME_RULES.map.midlineX - x) / span) * 0.35;
}

function rawScore(x: number, y: number, sources: readonly InfluenceSource[]) {
  const sigma2 = INFLUENCE_SIGMA * INFLUENCE_SIGMA * 2;
  let score = staticBias(x);
  for (const source of sources) {
    const dx = x - source.x;
    const dy = y - source.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > INFLUENCE_SIGMA * INFLUENCE_SIGMA * 36) continue;
    score += sideSign(source.side) * source.weight * Math.exp(-d2 / sigma2);
  }
  return score;
}

export function updateInfluence(field: InfluenceField, view: MatchView, dtMs: number) {
  field.accumulatorMs += Math.min(Math.max(dtMs, 0), 500);
  let updated = false;
  while (field.accumulatorMs >= INFLUENCE_UPDATE_MS) {
    field.accumulatorMs -= INFLUENCE_UPDATE_MS;
    const sources = influenceSources(view);
    const alpha = 1 - Math.exp(-INFLUENCE_UPDATE_MS / INFLUENCE_TAU_MS);
    field.previous.set(field.current);
    for (let row = 0; row < field.rows; row++) {
      for (let col = 0; col < field.cols; col++) {
        const i = row * field.cols + col;
        if (!field.land[i]) {
          field.current[i] = 0;
          continue;
        }
        const x = field.originX + col * field.cellSize;
        const y = field.originY + row * field.cellSize;
        const target = rawScore(x, y, sources);
        field.current[i] += (target - field.current[i]) * alpha;
      }
    }
    field.version += 1;
    updated = true;
  }
  return updated;
}

export function influenceValueAt(field: InfluenceField, x: number, y: number, values = field.current) {
  const fx = (x - field.originX) / field.cellSize;
  const fy = (y - field.originY) / field.cellSize;
  const x0 = Math.max(0, Math.min(field.cols - 1, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(field.rows - 1, Math.floor(fy)));
  const x1 = Math.min(field.cols - 1, x0 + 1);
  const y1 = Math.min(field.rows - 1, y0 + 1);
  const tx = Math.max(0, Math.min(1, fx - x0));
  const ty = Math.max(0, Math.min(1, fy - y0));
  const a = values[y0 * field.cols + x0];
  const b = values[y0 * field.cols + x1];
  const c = values[y1 * field.cols + x0];
  const d = values[y1 * field.cols + x1];
  return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
}

const CASES: readonly (readonly number[])[] = [
  [],
  [3, 0],
  [0, 1],
  [3, 1],
  [1, 2],
  [3, 0, 1, 2],
  [0, 2],
  [3, 2],
  [2, 3],
  [0, 2],
  [0, 1, 2, 3],
  [1, 2],
  [1, 3],
  [0, 1],
  [0, 3],
  []
];

function interpolate(a: Vec2, b: Vec2, va: number, vb: number): Vec2 {
  const denom = vb - va;
  const t = Math.abs(denom) < 1e-6 ? 0.5 : Math.max(0, Math.min(1, -va / denom));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function pointKey(point: Vec2) {
  return `${Math.round(point.x * 10)}:${Math.round(point.y * 10)}`;
}

function connectSegments(segments: { a: Vec2; b: Vec2 }[]) {
  const adjacency = new Map<string, number[]>();
  segments.forEach((segment, index) => {
    for (const point of [segment.a, segment.b]) {
      const key = pointKey(point);
      const list = adjacency.get(key) ?? [];
      list.push(index);
      adjacency.set(key, list);
    }
  });

  const used = new Uint8Array(segments.length);
  const paths: Vec2[][] = [];
  const extend = (points: Vec2[], forward: boolean) => {
    for (;;) {
      const key = pointKey(forward ? points[points.length - 1] : points[0]);
      const candidates = adjacency.get(key) ?? [];
      const next = candidates.find((index) => !used[index]);
      if (next === undefined) return;
      used[next] = 1;
      const edge = segments[next];
      const anchor = forward ? points[points.length - 1] : points[0];
      const other = pointKey(edge.a) === pointKey(anchor) ? edge.b : edge.a;
      if (forward) points.push(other);
      else points.unshift(other);
    }
  };

  segments.forEach((segment, index) => {
    if (used[index]) return;
    used[index] = 1;
    const points = [segment.a, segment.b];
    extend(points, true);
    extend(points, false);
    paths.push(points);
  });
  return paths;
}

function smooth(points: Vec2[]) {
  if (points.length < 3) return points;
  const out: Vec2[] = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
  }
  out.push(points[points.length - 1]);
  return out;
}

function chaikin(points: Vec2[], rounds = 2) {
  let current = points;
  for (let round = 0; round < rounds; round++) current = smooth(current);
  return current;
}

export function influenceContours(field: InfluenceField): InfluenceContours {
  const segments: { a: Vec2; b: Vec2 }[] = [];
  const edgePoint = (edge: number, tl: Vec2, tr: Vec2, br: Vec2, bl: Vec2, vt: number[]) => {
    switch (edge) {
      case 0: return interpolate(tl, tr, vt[0], vt[1]);
      case 1: return interpolate(tr, br, vt[1], vt[2]);
      case 2: return interpolate(br, bl, vt[2], vt[3]);
      default: return interpolate(bl, tl, vt[3], vt[0]);
    }
  };

  for (let row = 0; row < field.rows - 1; row++) {
    for (let col = 0; col < field.cols - 1; col++) {
      const i = row * field.cols + col;
      const ir = i + 1;
      const ib = i + field.cols;
      const ibr = ib + 1;
      if (!field.land[i] || !field.land[ir] || !field.land[ib] || !field.land[ibr]) continue;
      const tl = { x: field.originX + col * field.cellSize, y: field.originY + row * field.cellSize };
      const tr = { x: tl.x + field.cellSize, y: tl.y };
      const bl = { x: tl.x, y: tl.y + field.cellSize };
      const br = { x: tr.x, y: bl.y };
      const vt = [field.current[i], field.current[ir], field.current[ibr], field.current[ib]];
      const mask = (vt[0] >= 0 ? 1 : 0) | (vt[1] >= 0 ? 2 : 0) | (vt[2] >= 0 ? 4 : 0) | (vt[3] >= 0 ? 8 : 0);
      const pairs = CASES[mask];
      for (let p = 0; p < pairs.length; p += 2) {
        segments.push({
          a: edgePoint(pairs[p], tl, tr, br, bl, vt),
          b: edgePoint(pairs[p + 1], tl, tr, br, bl, vt)
        });
      }
    }
  }

  const raw = connectSegments(segments);
  const frontLines: Vec2[][] = [];
  const polygons: InfluencePolygon[] = [];
  for (const path of raw) {
    const closed = path.length > 3 && pointKey(path[0]) === pointKey(path[path.length - 1]);
    const length = path.reduce((sum, point, i) => (i ? sum + Math.hypot(point.x - path[i - 1].x, point.y - path[i - 1].y) : sum), 0);
    if (length < field.cellSize * 1.5) continue;
    const points = chaikin(path, 2);
    if (closed) {
      const center = points.reduce((acc, point) => ({ x: acc.x + point.x / points.length, y: acc.y + point.y / points.length }), { x: 0, y: 0 });
      polygons.push({ side: influenceValueAt(field, center.x, center.y) >= 0 ? 'blue' : 'red', points });
    } else {
      frontLines.push(points);
    }
  }
  return { frontLines, polygons };
}
