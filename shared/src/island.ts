import type { Vec2 } from './types.js';

/**
 * The island both kingdoms fight on. Its coastline is a rounded rectangle pushed outwards by a
 * smooth wave. The wave is a sum of cosines of the perimeter position measured from the top of the
 * midline, so the coast is an exact mirror image across it and neither kingdom gets more land.
 * The same shape decides where troops walk, where buildings go and how the map is drawn.
 */

const MIDLINE_X = 960;
/** Rounded rectangle the coast is built around. Every point of it is land. */
const CORE = { minX: 160, maxX: 1760, minY: 148, maxY: 932, radius: 64 };
/** How far the coast lies outside the core: never less than MIN_MARGIN, never more than MAX_MARGIN. */
const MIN_MARGIN = 12;
const MAX_MARGIN = 82;
const WAVES = [
  { k: 2, a: 0.35 },
  { k: 3, a: -0.7 },
  { k: 5, a: 1 },
  { k: 7, a: -0.55 },
  { k: 9, a: 0.7 },
  { k: 12, a: -0.4 },
  { k: 16, a: 0.3 },
  { k: 23, a: -0.2 },
  { k: 37, a: 0.1 }
];
/** Sampling step when checking that a segment near the coast stays on land. */
const SEGMENT_STEP = 8;

const INNER = {
  minX: CORE.minX + CORE.radius,
  maxX: CORE.maxX - CORE.radius,
  minY: CORE.minY + CORE.radius,
  maxY: CORE.maxY - CORE.radius
};
const STRAIGHT_X = INNER.maxX - INNER.minX;
const STRAIGHT_Y = INNER.maxY - INNER.minY;
const ARC = (Math.PI * CORE.radius) / 2;
export const COAST_PERIMETER = 2 * STRAIGHT_X + 2 * STRAIGHT_Y + 4 * ARC;

/** Perimeter position where each part of the core outline starts, clockwise from the top of the midline. */
const START = {
  topRight: 0,
  arcTopRight: STRAIGHT_X / 2,
  right: STRAIGHT_X / 2 + ARC,
  arcBottomRight: STRAIGHT_X / 2 + ARC + STRAIGHT_Y,
  bottom: STRAIGHT_X / 2 + 2 * ARC + STRAIGHT_Y,
  arcBottomLeft: STRAIGHT_X * 1.5 + 2 * ARC + STRAIGHT_Y,
  left: STRAIGHT_X * 1.5 + 3 * ARC + STRAIGHT_Y,
  arcTopLeft: STRAIGHT_X * 1.5 + 3 * ARC + 2 * STRAIGHT_Y,
  topLeft: STRAIGHT_X * 1.5 + 4 * ARC + 2 * STRAIGHT_Y
};

const wave = (t: number) => WAVES.reduce((sum, w) => sum + w.a * Math.cos(2 * Math.PI * w.k * t), 0);
const [WAVE_LOW, WAVE_HIGH] = (() => {
  let low = Infinity;
  let high = -Infinity;
  for (let i = 0; i < 4096; i++) {
    const value = wave(i / 4096);
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  return [low, high];
})();

/** Distance from the core to the coast at perimeter position `s`. */
function margin(s: number) {
  const t = (wave(s / COAST_PERIMETER) - WAVE_LOW) / (WAVE_HIGH - WAVE_LOW);
  return MIN_MARGIN + (MAX_MARGIN - MIN_MARGIN) * Math.min(1, Math.max(0, t));
}

/** A point on the core outline with its outward normal and perimeter position. */
export interface CoastSample {
  x: number;
  y: number;
  nx: number;
  ny: number;
  /** Distance from this core point out to the coast along the normal. */
  margin: number;
}

interface CorePoint {
  x: number;
  y: number;
  nx: number;
  ny: number;
  s: number;
}

const arcPoint = (cx: number, cy: number, angle: number, s: number): CorePoint => ({
  x: cx + Math.cos(angle) * CORE.radius,
  y: cy + Math.sin(angle) * CORE.radius,
  nx: Math.cos(angle),
  ny: Math.sin(angle),
  s
});

/** The core outline point at perimeter position `s`. */
function coreAt(s: number): CorePoint {
  s = ((s % COAST_PERIMETER) + COAST_PERIMETER) % COAST_PERIMETER;
  const r = CORE.radius;
  if (s < START.arcTopRight) return { x: MIDLINE_X + s, y: CORE.minY, nx: 0, ny: -1, s };
  if (s < START.right) return arcPoint(INNER.maxX, INNER.minY, -Math.PI / 2 + (s - START.arcTopRight) / r, s);
  if (s < START.arcBottomRight) return { x: CORE.maxX, y: INNER.minY + s - START.right, nx: 1, ny: 0, s };
  if (s < START.bottom) return arcPoint(INNER.maxX, INNER.maxY, (s - START.arcBottomRight) / r, s);
  if (s < START.arcBottomLeft) return { x: INNER.maxX - (s - START.bottom), y: CORE.maxY, nx: 0, ny: 1, s };
  if (s < START.left) return arcPoint(INNER.minX, INNER.maxY, Math.PI / 2 + (s - START.arcBottomLeft) / r, s);
  if (s < START.arcTopLeft) return { x: CORE.minX, y: INNER.maxY - (s - START.left), nx: -1, ny: 0, s };
  if (s < START.topLeft) return arcPoint(INNER.minX, INNER.minY, Math.PI + (s - START.arcTopLeft) / r, s);
  return { x: INNER.minX + s - START.topLeft, y: CORE.minY, nx: 0, ny: -1, s };
}

/** The nearest core outline point to (x, y), with the signed distance to it (negative inside the core). */
function nearestCore(x: number, y: number): CorePoint & { distance: number } {
  const r = CORE.radius;
  const qx = Math.min(INNER.maxX, Math.max(INNER.minX, x));
  const qy = Math.min(INNER.maxY, Math.max(INNER.minY, y));
  const dx = x - qx;
  const dy = y - qy;

  if (dx === 0 && dy === 0) {
    // Inside the inner rectangle: the closest straight edge wins.
    const top = y - CORE.minY;
    const right = CORE.maxX - x;
    const bottom = CORE.maxY - y;
    const left = x - CORE.minX;
    const gap = Math.min(top, right, bottom, left);
    if (gap === top) return { ...coreAt(x >= MIDLINE_X ? x - MIDLINE_X : START.topLeft + x - INNER.minX), distance: -gap };
    if (gap === right) return { ...coreAt(START.right + y - INNER.minY), distance: -gap };
    if (gap === bottom) return { ...coreAt(START.bottom + INNER.maxX - x), distance: -gap };
    return { ...coreAt(START.left + INNER.maxY - y), distance: -gap };
  }

  const length = Math.hypot(dx, dy);
  const distance = length - r;
  if (dx === 0) {
    const s = dy < 0 ? (qx >= MIDLINE_X ? qx - MIDLINE_X : START.topLeft + qx - INNER.minX) : START.bottom + INNER.maxX - qx;
    return { ...coreAt(s), distance };
  }
  if (dy === 0) {
    const s = dx > 0 ? START.right + qy - INNER.minY : START.left + INNER.maxY - qy;
    return { ...coreAt(s), distance };
  }
  const angle = Math.atan2(dy, dx);
  let s: number;
  if (dx > 0 && dy < 0) s = START.arcTopRight + (angle + Math.PI / 2) * r;
  else if (dx > 0) s = START.arcBottomRight + angle * r;
  else if (dy > 0) s = START.arcBottomLeft + (angle - Math.PI / 2) * r;
  else s = START.arcTopLeft + (angle + Math.PI) * r;
  return { ...arcPoint(qx, qy, angle, s), distance };
}

/** True when (x, y) is on the island and at least `padding` from the shore. */
export function isWalkableLand(x: number, y: number, padding = 0) {
  const core = nearestCore(x, y);
  return core.distance <= margin(core.s) - padding;
}

/** Clamp a point to the island, keeping `padding` from the shore. */
export function clampToIsland(x: number, y: number, padding = 0): Vec2 {
  const core = nearestCore(x, y);
  const limit = margin(core.s) - padding;
  if (core.distance <= limit) return { x, y };
  return { x: core.x + core.nx * limit, y: core.y + core.ny * limit };
}

const insideCore = (x: number, y: number) => {
  const dx = x - Math.min(INNER.maxX, Math.max(INNER.minX, x));
  const dy = y - Math.min(INNER.maxY, Math.max(INNER.minY, y));
  return dx * dx + dy * dy <= CORE.radius * CORE.radius;
};

/** True when the whole segment A→B stays on the island, `padding` from the shore. */
export function segmentOnLand(ax: number, ay: number, bx: number, by: number, padding = 0) {
  // The core is convex and entirely land, which settles almost every segment at once.
  if (padding <= MIN_MARGIN && insideCore(ax, ay) && insideCore(bx, by)) return true;
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / SEGMENT_STEP));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!isWalkableLand(ax + (bx - ax) * t, ay + (by - ay) * t, padding)) return false;
  }
  return true;
}

/** Evenly spaced points around the core with their outward normals and margins, clockwise from the top of the midline. */
export function coastSamples(count: number): CoastSample[] {
  return Array.from({ length: count }, (_, i) => {
    const point = coreAt((i / count) * COAST_PERIMETER);
    return { x: point.x, y: point.y, nx: point.nx, ny: point.ny, margin: margin(point.s) };
  });
}

/** The coastline as a closed polygon. */
export function coastline(count = 720): Vec2[] {
  return coastSamples(count).map((p) => ({ x: p.x + p.nx * p.margin, y: p.y + p.ny * p.margin }));
}

/** The land along the vertical line x = `x`, keeping `padding` from the shore, or null if there is none. */
export function islandSpanY(x: number, padding = 0) {
  const middle = (CORE.minY + CORE.maxY) / 2;
  if (!isWalkableLand(x, middle, padding)) return null;
  const edge = (sea: number) => {
    let land = middle;
    for (let i = 0; i < 30; i++) {
      const y = (land + sea) / 2;
      if (isWalkableLand(x, y, padding)) land = y;
      else sea = y;
    }
    return land;
  };
  return { minY: edge(CORE.minY - MAX_MARGIN - 1), maxY: edge(CORE.maxY + MAX_MARGIN + 1) };
}
