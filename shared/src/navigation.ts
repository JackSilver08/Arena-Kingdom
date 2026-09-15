import { BUILDING_STATS, GAME_RULES, UNIT_STATS, isWalkableLand, segmentOnLand } from './rules.js';
import type { BuildingType, Side, Vec2 } from './types.js';

const CELL = 16;
/** Walls are inflated by a troop's radius plus a little slack. */
const CLEARANCE = UNIT_STATS.soldier.radius + 2;
const SEARCH_RADIUS_CELLS = 8;
/** Extra cost of stepping through a cell covered by an enemy wall when looking for one to break. */
const WALL_CELL_COST = 12;

interface Wall {
  id: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface PathResult {
  points: Vec2[];
  /** The last point, which differs from the goal when the goal itself is walled off. */
  end: Vec2;
}

/**
 * Entry parameter (0..1) where segment A→B first touches the rectangle, or null.
 * Liang–Barsky clipping.
 */
function segmentEntry(ax: number, ay: number, bx: number, by: number, wall: Wall): number | null {
  const dx = bx - ax;
  const dy = by - ay;
  let t0 = 0;
  let t1 = 1;
  const checks: [number, number][] = [
    [-dx, ax - wall.minX],
    [dx, wall.maxX - ax],
    [-dy, ay - wall.minY],
    [dy, wall.maxY - ay]
  ];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return t0;
}

class MinHeap {
  private items: number[] = [];
  private scores: number[] = [];

  get size() {
    return this.items.length;
  }

  push(item: number, score: number) {
    const items = this.items;
    const scores = this.scores;
    let i = items.length;
    items.push(item);
    scores.push(score);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (scores[parent] <= score) break;
      items[i] = items[parent];
      scores[i] = scores[parent];
      i = parent;
    }
    items[i] = item;
    scores[i] = score;
  }

  pop() {
    const items = this.items;
    const scores = this.scores;
    const top = items[0];
    const lastItem = items.pop()!;
    const lastScore = scores.pop()!;
    if (items.length) {
      let i = 0;
      const n = items.length;
      for (;;) {
        const left = i * 2 + 1;
        if (left >= n) break;
        const right = left + 1;
        const child = right < n && scores[right] < scores[left] ? right : left;
        if (scores[child] >= lastScore) break;
        items[i] = items[child];
        scores[i] = scores[child];
        i = child;
      }
      items[i] = lastItem;
      scores[i] = lastScore;
    }
    return top;
  }
}

/**
 * Grid navigation around fences. Each side has its own grid: a side is only
 * blocked by the other side's fences.
 */
export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  /** Bumped whenever walls change so cached paths can be invalidated. */
  version = 0;
  private readonly originX: number;
  private readonly originY: number;
  /** Ocean cells. Both islands and the two bridges share one grid, so troops cross only on the bridges. */
  private readonly terrain: Uint8Array;
  /** Terrain plus enemy walls. */
  private readonly blocked: Record<Side, Uint8Array>;
  /** How many enemy walls cover each cell. */
  private readonly wallCover: Record<Side, Uint8Array>;
  private walls: Record<Side, Wall[]> = { blue: [], red: [] };

  constructor() {
    const { island } = GAME_RULES.map;
    this.originX = island.x;
    this.originY = island.y;
    this.cols = Math.ceil(island.width / CELL);
    this.rows = Math.ceil(island.height / CELL);
    const n = this.cols * this.rows;
    this.terrain = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const { x, y } = this.center(i);
      if (!isWalkableLand(x, y, UNIT_STATS.soldier.radius)) this.terrain[i] = 1;
    }
    this.blocked = { blue: this.terrain.slice(), red: this.terrain.slice() };
    this.wallCover = { blue: new Uint8Array(n), red: new Uint8Array(n) };
  }

  rebuild(buildings: readonly { id: number; side: Side; type: BuildingType; x: number; y: number; hp: number }[]) {
    this.walls = { blue: [], red: [] };
    for (const b of buildings) {
      if (b.type !== 'fence' || b.hp <= 0) continue;
      const stats = BUILDING_STATS.fence;
      // A fence blocks the opposing side only.
      this.walls[b.side === 'blue' ? 'red' : 'blue'].push({
        id: b.id,
        minX: b.x - stats.halfWidth - CLEARANCE,
        maxX: b.x + stats.halfWidth + CLEARANCE,
        minY: b.y - stats.halfHeight - CLEARANCE,
        maxY: b.y + stats.halfHeight + CLEARANCE
      });
    }
    for (const side of ['blue', 'red'] as const) {
      const grid = this.blocked[side];
      const cover = this.wallCover[side];
      grid.set(this.terrain);
      cover.fill(0);
      for (const wall of this.walls[side]) {
        const c0 = Math.max(0, Math.floor((wall.minX - this.originX) / CELL));
        const c1 = Math.min(this.cols - 1, Math.floor((wall.maxX - this.originX) / CELL));
        const r0 = Math.max(0, Math.floor((wall.minY - this.originY) / CELL));
        const r1 = Math.min(this.rows - 1, Math.floor((wall.maxY - this.originY) / CELL));
        for (let r = r0; r <= r1; r++) {
          const cy = this.originY + (r + 0.5) * CELL;
          if (cy < wall.minY || cy > wall.maxY) continue;
          for (let c = c0; c <= c1; c++) {
            const cx = this.originX + (c + 0.5) * CELL;
            if (cx < wall.minX || cx > wall.maxX) continue;
            const i = r * this.cols + c;
            grid[i] = 1;
            cover[i] = Math.min(255, cover[i] + 1);
          }
        }
      }
    }
    this.version += 1;
  }

  /** The first wall crossed by the straight line A→B, or null when the line is clear. */
  firstWall(side: Side, ax: number, ay: number, bx: number, by: number, ignoreId?: number) {
    let best: { id: number; t: number } | null = null;
    for (const wall of this.walls[side]) {
      if (wall.id === ignoreId) continue;
      const t = segmentEntry(ax, ay, bx, by, wall);
      if (t !== null && (!best || t < best.t)) best = { id: wall.id, t };
    }
    return best;
  }

  /** True when a troop can walk straight from A to B: no ocean and no enemy wall on the way. */
  lineClear(side: Side, ax: number, ay: number, bx: number, by: number, ignoreId?: number) {
    return segmentOnLand(ax, ay, bx, by, UNIT_STATS.soldier.radius) && !this.firstWall(side, ax, ay, bx, by, ignoreId);
  }

  /** The wall covering a point, if any. */
  wallAt(side: Side, x: number, y: number) {
    return this.walls[side].find((w) => x >= w.minX && x <= w.maxX && y >= w.minY && y <= w.maxY)?.id ?? null;
  }

  /** The nearest walkable point to (x, y). */
  openPoint(side: Side, x: number, y: number): Vec2 {
    const cell = this.cellOf(x, y);
    if (!this.blocked[side][cell]) return { x, y };
    const open = this.nearestOpen(this.blocked[side], cell);
    return open < 0 ? { x, y } : this.center(open);
  }

  findPath(side: Side, from: Vec2, to: Vec2, ignoreId?: number): PathResult | null {
    const grid = ignoreId === undefined ? this.blocked[side] : this.gridWithout(side, ignoreId);
    const start = this.nearestOpen(grid, this.cellOf(from.x, from.y));
    const goalCell = this.cellOf(to.x, to.y);
    const goal = this.nearestOpen(grid, goalCell);
    if (start < 0 || goal < 0) return null;
    const exactGoal = goal === goalCell;
    const end = exactGoal ? { x: to.x, y: to.y } : this.center(goal);
    if (start === goal) return { points: [end], end };

    const cells = this.search(grid, start, goal);
    if (!cells) return null;
    const raw = cells.map((c) => this.center(c));
    raw[raw.length - 1] = end;

    // String-pulling: skip waypoints while the straight line stays on land and clear of walls.
    const points: Vec2[] = [];
    let anchor = from;
    let i = 0;
    while (i < raw.length) {
      let j = raw.length - 1;
      while (j > i && !this.lineClear(side, anchor.x, anchor.y, raw[j].x, raw[j].y, ignoreId)) j--;
      points.push(raw[j]);
      anchor = raw[j];
      i = j + 1;
    }
    return { points, end };
  }

  /**
   * The enemy wall to break when `to` cannot be reached: the first wall on the cheapest route
   * that may cut through walls at a cost. Unlike the straight line, this finds the wall that
   * actually seals a bridge.
   */
  wallToBreach(side: Side, from: Vec2, to: Vec2): number | null {
    if (!this.walls[side].length) return null;
    const cover = this.wallCover[side];
    const start = this.nearestOpen(this.terrain, this.cellOf(from.x, from.y));
    const goal = this.nearestOpen(this.terrain, this.cellOf(to.x, to.y));
    if (start < 0 || goal < 0) return null;
    const cells = start === goal ? [] : this.search(this.terrain, start, goal, cover);
    if (!cells) return null;
    for (const cell of [start, ...cells]) {
      if (!cover[cell]) continue;
      const { x, y } = this.center(cell);
      return this.wallAt(side, x, y);
    }
    return null;
  }

  /** A* over open cells; `penalty` adds WALL_CELL_COST per count. Returns the cells after `start` up to `goal`. */
  private search(grid: Uint8Array, start: number, goal: number, penalty?: Uint8Array): number[] | null {
    const n = this.cols * this.rows;
    const cost = new Float32Array(n).fill(Infinity);
    const came = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const heap = new MinHeap();
    const gx = goal % this.cols;
    const gy = Math.floor(goal / this.cols);
    const heuristic = (i: number) => {
      const dx = Math.abs((i % this.cols) - gx);
      const dy = Math.abs(Math.floor(i / this.cols) - gy);
      return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
    };
    cost[start] = 0;
    heap.push(start, heuristic(start));
    let found = false;
    while (heap.size) {
      const current = heap.pop();
      if (current === goal) {
        found = true;
        break;
      }
      if (closed[current]) continue;
      closed[current] = 1;
      const cx = current % this.cols;
      const cy = Math.floor(current / this.cols);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
          const next = ny * this.cols + nx;
          if (grid[next] || closed[next]) continue;
          // No cutting corners past a wall.
          if (dx && dy && (grid[cy * this.cols + nx] || grid[ny * this.cols + cx])) continue;
          const nextCost = cost[current] + (dx && dy ? Math.SQRT2 : 1) + (penalty ? penalty[next] * WALL_CELL_COST : 0);
          if (nextCost < cost[next]) {
            cost[next] = nextCost;
            came[next] = current;
            heap.push(next, nextCost + heuristic(next));
          }
        }
      }
    }
    if (!found) return null;

    const cells: number[] = [];
    for (let c = goal; c !== start && c !== -1; c = came[c]) cells.push(c);
    return cells.reverse();
  }

  private gridWithout(side: Side, ignoreId: number) {
    const wall = this.walls[side].find((w) => w.id === ignoreId);
    if (!wall) return this.blocked[side];
    const copy = new Uint8Array(this.blocked[side]);
    const others = this.walls[side].filter((w) => w.id !== ignoreId);
    for (let i = 0; i < copy.length; i++) {
      if (!copy[i]) continue;
      const { x, y } = this.center(i);
      if (x < wall.minX || x > wall.maxX || y < wall.minY || y > wall.maxY) continue;
      if (!others.some((w) => x >= w.minX && x <= w.maxX && y >= w.minY && y <= w.maxY)) copy[i] = 0;
    }
    return copy;
  }

  private cellOf(x: number, y: number) {
    const c = Math.min(this.cols - 1, Math.max(0, Math.floor((x - this.originX) / CELL)));
    const r = Math.min(this.rows - 1, Math.max(0, Math.floor((y - this.originY) / CELL)));
    return r * this.cols + c;
  }

  private center(cell: number): Vec2 {
    return {
      x: this.originX + ((cell % this.cols) + 0.5) * CELL,
      y: this.originY + (Math.floor(cell / this.cols) + 0.5) * CELL
    };
  }

  private nearestOpen(grid: Uint8Array, cell: number) {
    if (!grid[cell]) return cell;
    const cx = cell % this.cols;
    const cy = Math.floor(cell / this.cols);
    for (let radius = 1; radius <= SEARCH_RADIUS_CELLS; radius++) {
      let best = -1;
      let bestDistance = Infinity;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
          const i = ny * this.cols + nx;
          const d = dx * dx + dy * dy;
          if (!grid[i] && d < bestDistance) {
            best = i;
            bestDistance = d;
          }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }
}
