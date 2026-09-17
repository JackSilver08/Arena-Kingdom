import { GAME_RULES } from './rules.js';
import { isWalkableLand } from './island.js';
import type { MatchView, Side, Vec2 } from './types.js';

export const INFLUENCE_CELL_SIZE = 40;
export const INFLUENCE_UPDATE_MS = 333;
export const INFLUENCE_SIGMA = 90;
export const INFLUENCE_TAU_MS = 1500;

const SOURCE_CUTOFF = 360;
const WEIGHTS: Record<string, number> = {
  soldier: 1,
  village: 2,
  tower: 3,
  barracks: 3,
  castle: 6,
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
  readonly target: Float32Array;
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
    target: new Float32Array(cols * rows),
    accumulatorMs: INFLUENCE_UPDATE_MS,
    version: 0
  };
}

export function influenceSources(view: MatchView): InfluenceSource[] {
  const sources: InfluenceSource[] = [];
  for (const unit of view.units) {
    if (unit.hp <= 0) continue;
    sources.push({ side: unit.side, x: unit.x, y: unit.y, weight: WEIGHTS[unit.type] ?? 1 });
  }
  for (const building of view.buildings) {
    if (building.hp <= 0) continue;
    sources.push({ side: building.side, x: building.x, y: building.y, weight: WEIGHTS[building.type] ?? 1 });
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
    if (d2 > SOURCE_CUTOFF * SOURCE_CUTOFF) continue;
    score += sideSign(source.side) * source.weight * Math.exp(-d2 / sigma2);
  }
  return score;
}

/** Updates presentation-only control values; it never mutates simulation state. */
export function updateInfluence(field: InfluenceField, view: MatchView, dtMs: number) {
  const dt = Math.min(Math.max(dtMs, 0), 500);
  field.accumulatorMs += dt;
  let targetUpdated = false;

  while (field.accumulatorMs >= INFLUENCE_UPDATE_MS) {
    field.accumulatorMs -= INFLUENCE_UPDATE_MS;
    field.previous.set(field.current);
    const sources = influenceSources(view);
    for (let row = 0; row < field.rows; row++) {
      const y = field.originY + row * field.cellSize;
      for (let col = 0; col < field.cols; col++) {
        const i = row * field.cols + col;
        if (!field.land[i]) {
          field.target[i] = 0;
          continue;
        }
        const x = field.originX + col * field.cellSize;
        field.target[i] = rawScore(x, y, sources);
      }
    }
    field.version += 1;
    targetUpdated = true;
  }

  const alpha = 1 - Math.exp(-dt / INFLUENCE_TAU_MS);
  for (let i = 0; i < field.current.length; i++) {
    field.current[i] += (field.target[i] - field.current[i]) * alpha;
  }
  return targetUpdated;
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
  [0, 3, 1, 2],
  [1, 2],
  [3, 1],
  [0, 1],
  [3, 0],
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

interface ConnectedPath {
  points: Vec2[];
  closed: boolean;
}

function connectSegments(segments: { a: Vec2; b: Vec2 }[]): ConnectedPath[] {
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
  const paths: ConnectedPath[] = [];

  for (let start = 0; start < segments.length; start++) {
    if (used[start]) continue;
    used[start] = 1;
    const first = segments[start];
    const points = [first.a, first.b];
    let closed = false;

    const grow = (forward: boolean) => {
      for (;;) {
        const anchor = forward ? points[points.length - 1] : points[0];
        const anchorKey = pointKey(anchor);
        const startKey = pointKey(forward ? points[0] : points[points.length - 1]);
        const candidates = adjacency.get(anchorKey) ?? [];
        const nextIndex = candidates.find((index) => !used[index]);
        if (nextIndex === undefined) return;
        const next = segments[nextIndex];
        used[nextIndex] = 1;
        const other = pointKey(next.a) === anchorKey ? next.b : next.a;
        if (forward) points.push(other);
        else points.unshift(other);
        if (pointKey(other) === startKey) {
          closed = true;
          return;
        }
      }
    };

    grow(true);
    if (!closed) grow(false);
    paths.push({ points, closed });
  }
  return paths;
}

function chaikinOpen(points: Vec2[], rounds = 2) {
  let current = points;
  for (let round = 0; round < rounds; round++) {
    if (current.length < 3) return current;
    const next: Vec2[] = [current[0]];
    for (let i = 0; i < current.length - 1; i++) {
      const a = current[i];
      const b = current[i + 1];
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
}

function chaikinClosed(points: Vec2[], rounds = 2) {
  let current = points.slice(0, -1);
  for (let round = 0; round < rounds; round++) {
    if (current.length < 3) break;
    const next: Vec2[] = [];
    for (let i = 0; i < current.length; i++) {
      const a = current[i];
      const b = current[(i + 1) % current.length];
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    current = next;
  }
  return [...current, current[0]];
}

function polygonArea(points: Vec2[]) {
  let area = 0;
  for (let i = 0; i < points.length - 1; i++) {
    area += points[i].x * points[i + 1].y - points[i + 1].x * points[i].y;
  }
  return area / 2;
}

export function influenceContours(field: InfluenceField): InfluenceContours {
  const segments: { a: Vec2; b: Vec2 }[] = [];
  for (let row = 0; row < field.rows - 1; row++) {
    for (let col = 0; col < field.cols - 1; col++) {
      const i = row * field.cols + col;
      const ir = i + 1;
      const ib = i + field.cols;
      const ibr = ib + 1;
      if (!field.land[i] || !field.land[ir] || !field.land[ib] || !field.land[ibr]) continue;

      const x = field.originX + col * field.cellSize;
      const y = field.originY + row * field.cellSize;
      const tl = { x, y };
      const tr = { x: x + field.cellSize, y };
      const br = { x: x + field.cellSize, y: y + field.cellSize };
      const bl = { x, y: y + field.cellSize };
      const values = [field.current[i], field.current[ir], field.current[ibr], field.current[ib]];
      const mask = (values[0] >= 0 ? 1 : 0) | (values[1] >= 0 ? 2 : 0) | (values[2] >= 0 ? 4 : 0) | (values[3] >= 0 ? 8 : 0);
      const edge = (index: number) => {
        switch (index) {
          case 0: return interpolate(tl, tr, values[0], values[1]);
          case 1: return interpolate(tr, br, values[1], values[2]);
          case 2: return interpolate(br, bl, values[2], values[3]);
          default: return interpolate(bl, tl, values[3], values[0]);
        }
      };
      const pairs = CASES[mask];
      for (let p = 0; p < pairs.length; p += 2) segments.push({ a: edge(pairs[p]), b: edge(pairs[p + 1]) });
    }
  }

  const frontLines: Vec2[][] = [];
  const polygons: InfluencePolygon[] = [];
  for (const path of connectSegments(segments)) {
    if (path.points.length < 4) continue;
    const length = path.points.reduce((sum, point, i) => (i ? sum + Math.hypot(point.x - path.points[i - 1].x, point.y - path.points[i - 1].y) : sum), 0);
    if (length < field.cellSize * 1.5) continue;
    const points = path.closed ? chaikinClosed(path.points, 2) : chaikinOpen(path.points, 2);
    frontLines.push(points);
    if (path.closed && Math.abs(polygonArea(points)) >= field.cellSize * field.cellSize * 0.2) {
      const center = points.reduce((acc, point) => ({ x: acc.x + point.x / points.length, y: acc.y + point.y / points.length }), { x: 0, y: 0 });
      polygons.push({ side: influenceValueAt(field, center.x, center.y) >= 0 ? 'blue' : 'red', points });
    }
  }

  return { frontLines, polygons };
}
