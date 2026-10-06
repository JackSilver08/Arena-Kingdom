import { COAST_PERIMETER, GAME_RULES, coastSamples, type CoastSample } from '@arena-kingdom/shared';
import type { MapViewSize } from './mapArt';

/**
 * MOBA-style battlefield map inspired by League of Legends' Summoner's Rift.
 *
 * Replaces the military paper map with a lush, vibrant 2D top-down terrain:
 * - Rich green grass with biome variation
 * - A glowing river flowing through the neutral zone
 * - Dense jungle forests on both sides
 * - Terrain elevation (cliffs, plateaus)
 * - Lane-like pathways between kingdoms
 * - Vibrant, saturated color palette
 *
 * The geometry and coordinates are identical to the other map styles: only the
 * presentation changes, so pathfinding, placement, and hit-testing stay untouched.
 */

const svg = (viewBox: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;

const SAMPLE_SPACING = 7;

type Point = [number, number];
const fmt = ([x, y]: Point) => `${x.toFixed(1)} ${y.toFixed(1)}`;

const hash = (i: number, seed: number) => {
  const v = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
};

function smoothClosed(points: Point[]) {
  const mid = (i: number): Point => {
    const a = points[i], b = points[(i + 1) % points.length];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  };
  return `M${fmt(mid(points.length - 1))}` + points.map((p, i) => `Q${fmt(p)} ${fmt(mid(i))}`).join('') + 'Z';
}

const along = ({ x, y, nx, ny, margin }: CoastSample, outset: number): Point =>
  [x + nx * (margin + outset), y + ny * (margin + outset)];

function coastPath(samples: CoastSample[], outset: number, rough: number, seed: number) {
  const n = samples.length;
  const coarse = (i: number) => {
    const a = Math.floor(i / 4), f = i / 4 - a, u = f * f * (3 - 2 * f);
    return hash(a % (n / 4), seed) * (1 - u) + hash((a + 1) % (n / 4), seed) * u;
  };
  return 'M' + samples.map((s, i) => fmt(along(s, outset + rough * (.65 * coarse(i) + .35 * hash(i, seed + 1))))).join('L') + 'Z';
}

/** Jungle tree cluster at position */
function jungleTree(cx: number, cy: number, size: number, hue: number, seed: number) {
  const trunkW = size * 0.18;
  const canopyR = size * 0.52;
  // Slight random offsets for organic feel
  const ox = hash(seed, 1) * size * 0.1;
  const oy = hash(seed, 2) * size * 0.08;
  const x = cx + ox;
  const y = cy + oy;
  // Canopy color variation
  const lightness = 32 + hash(seed, 3) * 8;
  const sat = 55 + hash(seed, 4) * 15;
  return `<g>
    <ellipse cx="${x + 1.5}" cy="${y + size * 0.3}" rx="${canopyR * 0.9}" ry="${canopyR * 0.35}" fill="#0a1a08" opacity=".22"/>
    <rect x="${x - trunkW / 2}" y="${y - size * 0.05}" width="${trunkW}" height="${size * 0.35}" fill="#4a3520" rx="1"/>
    <circle cx="${x}" cy="${y - size * 0.1}" r="${canopyR}" fill="hsl(${hue}, ${sat}%, ${lightness}%)"/>
    <circle cx="${x - canopyR * 0.35}" cy="${y - size * 0.18}" r="${canopyR * 0.7}" fill="hsl(${hue + 8}, ${sat + 5}%, ${lightness + 6}%)"/>
    <circle cx="${x + canopyR * 0.4}" cy="${y - size * 0.05}" r="${canopyR * 0.65}" fill="hsl(${hue - 5}, ${sat}%, ${lightness - 3}%)"/>
    <circle cx="${x}" cy="${y - size * 0.22}" r="${canopyR * 0.35}" fill="hsl(${hue + 12}, ${sat - 5}%, ${lightness + 12}%)" opacity=".7"/>
  </g>`;
}

/** Dense forest grove */
function jungleGrove(cx: number, cy: number, radius: number, count: number, seed: number) {
  let trees = '';
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + hash(i, seed) * 0.5;
    const dist = (i === 0 ? 0 : 0.3 + hash(i, seed + 1) * 0.25) * radius;
    const size = 18 + hash(i, seed + 2) * 8;
    const hue = 118 + hash(i, seed + 3) * 20;
    trees += jungleTree(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, size, hue, seed * 100 + i);
  }
  return trees;
}

/** Rock formation */
function rockCluster(cx: number, cy: number, size: number, seed: number) {
  const rocks: string[] = [];
  const count = 2 + Math.abs(Math.round(hash(seed, 1) * 2));
  for (let i = 0; i < count; i++) {
    const ox = hash(i, seed + 10) * size * 0.6;
    const oy = hash(i, seed + 20) * size * 0.4;
    const r = size * (0.35 + hash(i, seed + 30) * 0.2);
    const light = 42 + hash(i, seed + 40) * 10;
    rocks.push(`<ellipse cx="${cx + ox + 1}" cy="${cy + oy + 2}" rx="${r}" ry="${r * 0.65}" fill="#0a0a08" opacity=".18"/>
      <ellipse cx="${cx + ox}" cy="${cy + oy}" rx="${r}" ry="${r * 0.65}" fill="hsl(200, 8%, ${light}%)" stroke="hsl(200, 12%, ${light - 12}%)" stroke-width="1.5"/>
      <ellipse cx="${cx + ox - r * 0.2}" cy="${cy + oy - r * 0.15}" rx="${r * 0.5}" ry="${r * 0.3}" fill="hsl(200, 6%, ${light + 10}%)" opacity=".5"/>`);
  }
  return `<g>${rocks.join('')}</g>`;
}

/** Grass detail patches */
function grassPatch(cx: number, cy: number, radius: number, seed: number) {
  let blades = '';
  const count = 6 + Math.abs(Math.round(hash(seed, 0) * 4));
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + hash(i, seed) * 0.8;
    const dist = hash(i, seed + 5) * radius * 0.8;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const h = 6 + hash(i, seed + 10) * 4;
    const lean = hash(i, seed + 15) * 3;
    const hue = 105 + hash(i, seed + 20) * 25;
    blades += `<path d="M${x} ${y} Q${x + lean} ${y - h * 0.6} ${x + lean * 1.5} ${y - h}" stroke="hsl(${hue}, 60%, 52%)" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
  }
  return blades;
}

/** Flower decoration */
function flowers(cx: number, cy: number, count: number, seed: number) {
  let result = '';
  for (let i = 0; i < count; i++) {
    const x = cx + hash(i, seed) * 30;
    const y = cy + hash(i, seed + 1) * 20;
    const hue = [340, 45, 280, 200, 30][i % 5];
    const r = 2.5 + hash(i, seed + 2) * 1.5;
    result += `<circle cx="${x}" cy="${y}" r="${r}" fill="hsl(${hue}, 75%, 65%)" opacity=".85"/>
      <circle cx="${x}" cy="${y}" r="${r * 0.4}" fill="hsl(${hue + 40}, 80%, 80%)"/>`;
  }
  return result;
}

export function arenaMapArtMoba(view: MapViewSize = GAME_RULES.map) {
  const { width: W, height: H, blueLand, redLand } = GAME_RULES.map;
  const sheetRect = { x: (W - view.width) / 2, y: (H - view.height) / 2, width: view.width, height: view.height };
  const full = `x="${sheetRect.x}" y="${sheetRect.y}" width="${view.width}" height="${view.height}"`;
  const samples = coastSamples(Math.round(COAST_PERIMETER / SAMPLE_SPACING / 4) * 4);

  // River path through the neutral zone (the "lane river" like in LoL)
  const riverLeft = blueLand.maxX;
  const riverRight = redLand.minX;
  const riverCx = (riverLeft + riverRight) / 2;
  const riverW = riverRight - riverLeft;

  // Jungle grove positions (blue side)
  const blueGroves = [
    { cx: 540, cy: 230, r: 70, count: 10 },
    { cx: 620, cy: 320, r: 55, count: 8 },
    { cx: 500, cy: 820, r: 72, count: 11 },
    { cx: 650, cy: 760, r: 58, count: 9 },
    { cx: 350, cy: 400, r: 62, count: 9 },
    { cx: 340, cy: 680, r: 65, count: 9 },
    { cx: 450, cy: 540, r: 48, count: 7 },
    { cx: 280, cy: 280, r: 50, count: 7 },
    { cx: 280, cy: 800, r: 55, count: 8 },
  ];

  // Mirror groves to red side
  const allGroves = [
    ...blueGroves,
    ...blueGroves.map(g => ({ ...g, cx: W - g.cx }))
  ];

  let grovesSvg = '';
  allGroves.forEach((g, i) => {
    grovesSvg += jungleGrove(g.cx, g.cy, g.r, g.count, i * 17 + 3);
  });

  // Rock clusters
  const rockPositions = [
    { cx: 700, cy: 340, s: 18 }, { cx: 1220, cy: 340, s: 18 },
    { cx: 700, cy: 740, s: 16 }, { cx: 1220, cy: 740, s: 16 },
    { cx: 460, cy: 480, s: 14 }, { cx: 1460, cy: 480, s: 14 },
    { cx: 460, cy: 600, s: 14 }, { cx: 1460, cy: 600, s: 14 },
    { cx: riverCx - 30, cy: 300, s: 12 }, { cx: riverCx + 30, cy: 780, s: 12 },
  ];
  let rocksSvg = '';
  rockPositions.forEach((r, i) => {
    rocksSvg += rockCluster(r.cx, r.cy, r.s, i * 13 + 7);
  });

  // Grass detail patches
  let grassSvg = '';
  const grassPositions = [
    { cx: 780, cy: 260 }, { cx: 1140, cy: 260 }, { cx: 780, cy: 820 }, { cx: 1140, cy: 820 },
    { cx: 600, cy: 540 }, { cx: 1320, cy: 540 },
    { cx: 750, cy: 450 }, { cx: 1170, cy: 450 }, { cx: 750, cy: 630 }, { cx: 1170, cy: 630 },
    { cx: 900, cy: 350 }, { cx: 1020, cy: 350 }, { cx: 900, cy: 730 }, { cx: 1020, cy: 730 },
  ];
  grassPositions.forEach((g, i) => {
    grassSvg += grassPatch(g.cx, g.cy, 20, i * 7 + 11);
  });

  // Flower spots
  let flowersSvg = '';
  const flowerPositions = [
    { cx: 750, cy: 500 }, { cx: 1170, cy: 500 },
    { cx: 860, cy: 380 }, { cx: 1060, cy: 700 },
    { cx: 550, cy: 450 }, { cx: 1370, cy: 450 },
    { cx: 550, cy: 630 }, { cx: 1370, cy: 630 },
  ];
  flowerPositions.forEach((f, i) => {
    flowersSvg += flowers(f.cx, f.cy, 4, i * 11 + 5);
  });

  // Lane paths (dirt roads connecting the two sides)
  const laneColor = '#a08b5e';
  const laneBorder = '#7a6840';

  return svg(`${sheetRect.x} ${sheetRect.y} ${view.width} ${view.height}`, `
    <defs>
      <path id="moba-coast" d="${coastPath(samples, 0, 2.2, 7)}"/>
      <clipPath id="moba-land"><use href="#moba-coast"/></clipPath>
      <clipPath id="moba-view"><rect x="${sheetRect.x}" y="${sheetRect.y}" width="${view.width}" height="${view.height}"/></clipPath>

      <!-- Water gradient: deep ocean -->
      <radialGradient id="moba-ocean" cx=".5" cy=".5" r=".72">
        <stop offset="0" stop-color="#1a5276" stop-opacity=".6"/>
        <stop offset=".5" stop-color="#154360"/>
        <stop offset="1" stop-color="#0b2e47"/>
      </radialGradient>
      <linearGradient id="moba-water-surface" x1="0" y1="0" x2=".3" y2="1">
        <stop offset="0" stop-color="#2980b9" stop-opacity=".4"/>
        <stop offset=".5" stop-color="#3498db" stop-opacity=".25"/>
        <stop offset="1" stop-color="#1a6fa0" stop-opacity=".35"/>
      </linearGradient>

      <!-- Grass gradients per side -->
      <linearGradient id="moba-blue-grass" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#2d7a3a"/>
        <stop offset=".4" stop-color="#3a9148"/>
        <stop offset=".7" stop-color="#48a356"/>
        <stop offset="1" stop-color="#55b060"/>
      </linearGradient>
      <linearGradient id="moba-red-grass" x1="1" x2="0" y1="0" y2="0">
        <stop offset="0" stop-color="#7a3a2d"/>
        <stop offset=".15" stop-color="#5a4a30"/>
        <stop offset=".4" stop-color="#3a8945"/>
        <stop offset="1" stop-color="#358040"/>
      </linearGradient>
      <linearGradient id="moba-grass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3e9e4a"/>
        <stop offset=".35" stop-color="#2d8a3c"/>
        <stop offset=".65" stop-color="#2a7d38"/>
        <stop offset="1" stop-color="#256e32"/>
      </linearGradient>

      <!-- River gradient -->
      <linearGradient id="moba-river" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5bc0de" stop-opacity=".95"/>
        <stop offset=".3" stop-color="#4db8d6"/>
        <stop offset=".5" stop-color="#3aadcc"/>
        <stop offset=".7" stop-color="#4db8d6"/>
        <stop offset="1" stop-color="#5bc0de" stop-opacity=".95"/>
      </linearGradient>
      <linearGradient id="moba-river-glow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8be4f7" stop-opacity=".4"/>
        <stop offset=".5" stop-color="#a8ecfa" stop-opacity=".2"/>
        <stop offset="1" stop-color="#8be4f7" stop-opacity=".4"/>
      </linearGradient>

      <!-- Lane path gradient -->
      <linearGradient id="moba-lane" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#c4a86a"/>
        <stop offset=".5" stop-color="#d4bc7e"/>
        <stop offset="1" stop-color="#b89a5c"/>
      </linearGradient>

      <!-- Grass texture pattern -->
      <pattern id="moba-grass-tex" width="48" height="40" patternUnits="userSpaceOnUse">
        <path d="M6 18l2-9 2 9M28 8l2-7 2 7M18 32l2-8 2 8M40 22l1.5-6 1.5 6" fill="none" stroke="#6fd07a" stroke-width="1.2" stroke-linecap="round" opacity=".32"/>
        <circle cx="14" cy="12" r="1.2" fill="#1e6e30" opacity=".35"/>
        <circle cx="36" cy="34" r="1" fill="#8ce098" opacity=".22"/>
      </pattern>

      <!-- Dark grass variation pattern -->
      <pattern id="moba-dark-grass" width="60" height="52" patternUnits="userSpaceOnUse">
        <path d="M8 20c4-6 8-6 12 0M32 38c3-4 7-4 10 0M44 12c3-5 7-5 10 0" fill="none" stroke="#1b5c28" stroke-width="2" opacity=".18"/>
        <circle cx="22" cy="8" r="1.5" fill="#225e2f" opacity=".3"/>
        <circle cx="50" cy="28" r="1" fill="#72c97e" opacity=".2"/>
      </pattern>

      <!-- Cliff/elevation edge effect -->
      <filter id="moba-cliff-shadow" x="-10%" y="-10%" width="130%" height="130%">
        <feGaussianBlur stdDeviation="6"/>
      </filter>
      <filter id="moba-soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3"/>
      </filter>

      <!-- Water caustics pattern -->
      <pattern id="moba-caustics" width="80" height="60" patternUnits="userSpaceOnUse">
        <path d="M10 20c12-8 28-8 40 0M5 45c15-10 35-10 50 0M30 8c8-5 18-5 26 0" fill="none" stroke="#a8ecfa" stroke-width="2.5" opacity=".18" stroke-linecap="round"/>
        <circle cx="60" cy="30" r="2" fill="#cef5ff" opacity=".12"/>
      </pattern>

      <!-- Terrain vignette -->
      <radialGradient id="moba-vignette" cx=".5" cy=".5" r=".72">
        <stop offset=".5" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity=".28"/>
      </radialGradient>

      <!-- Blue team territory highlight -->
      <linearGradient id="moba-blue-tint" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#3498db" stop-opacity=".06"/>
        <stop offset=".6" stop-color="#3498db" stop-opacity=".02"/>
        <stop offset="1" stop-color="#3498db" stop-opacity="0"/>
      </linearGradient>
      <!-- Red team territory highlight -->
      <linearGradient id="moba-red-tint" x1="1" y1="0" x2="0" y2="0">
        <stop offset="0" stop-color="#e74c3c" stop-opacity=".06"/>
        <stop offset=".6" stop-color="#e74c3c" stop-opacity=".02"/>
        <stop offset="1" stop-color="#e74c3c" stop-opacity="0"/>
      </linearGradient>
    </defs>

    <!-- Deep ocean background -->
    <rect ${full} fill="#0b2e47"/>
    <rect ${full} fill="url(#moba-ocean)"/>
    <rect ${full} fill="url(#moba-water-surface)"/>

    <g clip-path="url(#moba-view)">
      <!-- Animated water wave lines -->
      <g fill="none" stroke="#5dbed4" stroke-linecap="round" opacity=".22">
        <path d="M60 200c55-28 115-26 172 3s120 28 175-2" stroke-width="5"/>
        <path d="M1500 260c48-22 102-20 150 5s105 24 162-3" stroke-width="4.5"/>
        <path d="M90 840c62-25 125-22 185 8s115 25 168-3" stroke-width="5"/>
        <path d="M1440 880c54-28 108-26 164 2s110 26 164-4" stroke-width="5"/>
        <path d="M300 540c32-16 68-14 100 4s64 17 94-2" stroke-width="3.5"/>
        <path d="M1420 560c32-16 68-14 100 4s64 17 94-2" stroke-width="3.5"/>
      </g>

      <!-- Island shadow -->
      <use href="#moba-coast" fill="#041520" opacity=".4" filter="url(#moba-cliff-shadow)" transform="translate(0 10)"/>

      <!-- Cliff edge (darker ring around island) -->
      <use href="#moba-coast" fill="none" stroke="#1a4a2a" stroke-width="18" stroke-linejoin="round"/>
      <use href="#moba-coast" fill="none" stroke="#22633a" stroke-width="12" stroke-linejoin="round"/>

      <!-- Main island grass base -->
      <use href="#moba-coast" fill="url(#moba-grass)"/>

      <g clip-path="url(#moba-land)">
        <!-- Grass texture overlay -->
        <use href="#moba-coast" fill="url(#moba-grass-tex)" opacity=".6"/>
        <use href="#moba-coast" fill="url(#moba-dark-grass)" opacity=".5"/>

        <!-- Blue territory tint -->
        <rect x="${blueLand.minX}" y="${blueLand.minY}" width="${blueLand.maxX - blueLand.minX}" height="${blueLand.maxY - blueLand.minY}" fill="url(#moba-blue-tint)"/>
        <!-- Red territory tint -->
        <rect x="${redLand.minX}" y="${redLand.minY}" width="${redLand.maxX - redLand.minX}" height="${redLand.maxY - redLand.minY}" fill="url(#moba-red-tint)"/>

        <!-- Terrain elevation zones (subtle darker patches for depth) -->
        <ellipse cx="${W * 0.22}" cy="${H * 0.28}" rx="120" ry="80" fill="#1a5c28" opacity=".15"/>
        <ellipse cx="${W * 0.78}" cy="${H * 0.28}" rx="120" ry="80" fill="#1a5c28" opacity=".15"/>
        <ellipse cx="${W * 0.22}" cy="${H * 0.72}" rx="120" ry="80" fill="#1a5c28" opacity=".15"/>
        <ellipse cx="${W * 0.78}" cy="${H * 0.72}" rx="120" ry="80" fill="#1a5c28" opacity=".15"/>

        <!-- ==================== RIVER (Neutral Zone) ==================== -->
        <!-- River bed shadow -->
        <rect x="${riverLeft - 8}" y="${sheetRect.y}" width="${riverW + 16}" height="${view.height}" fill="#0a3040" opacity=".3" filter="url(#moba-soft)"/>

        <!-- River banks (earth edges) -->
        <rect x="${riverLeft - 5}" y="${sheetRect.y}" width="10" height="${view.height}" fill="#5a7a3a" opacity=".5"/>
        <rect x="${riverRight - 5}" y="${sheetRect.y}" width="10" height="${view.height}" fill="#5a7a3a" opacity=".5"/>

        <!-- Main river body -->
        <rect x="${riverLeft}" y="${sheetRect.y}" width="${riverW}" height="${view.height}" fill="url(#moba-river)"/>
        <rect x="${riverLeft}" y="${sheetRect.y}" width="${riverW}" height="${view.height}" fill="url(#moba-river-glow)"/>
        <rect x="${riverLeft}" y="${sheetRect.y}" width="${riverW}" height="${view.height}" fill="url(#moba-caustics)" opacity=".8"/>

        <!-- River shimmer highlights -->
        <g fill="none" stroke="#c8f0fa" stroke-linecap="round" opacity=".25">
          <path d="M${riverCx - 20} ${H * 0.15}c8-4 18-4 26 0s18 4 24 0" stroke-width="3"/>
          <path d="M${riverCx - 15} ${H * 0.35}c6-3 14-3 20 0s14 3 18 0" stroke-width="2.5"/>
          <path d="M${riverCx - 22} ${H * 0.55}c10-5 22-5 32 0" stroke-width="3"/>
          <path d="M${riverCx - 12} ${H * 0.75}c8-4 16-4 24 0" stroke-width="2.5"/>
          <path d="M${riverCx - 18} ${H * 0.9}c8-4 20-4 28 0s16 4 22 0" stroke-width="2.8"/>
        </g>

        <!-- River rocks -->
        <g>
          <ellipse cx="${riverCx - 15}" cy="${H * 0.25}" rx="8" ry="5" fill="#5a7a78" stroke="#3a5a58" stroke-width="1.5" opacity=".6"/>
          <ellipse cx="${riverCx + 18}" cy="${H * 0.5}" rx="10" ry="6" fill="#5a7a78" stroke="#3a5a58" stroke-width="1.5" opacity=".55"/>
          <ellipse cx="${riverCx - 10}" cy="${H * 0.78}" rx="7" ry="4.5" fill="#5a7a78" stroke="#3a5a58" stroke-width="1.5" opacity=".6"/>
        </g>

        <!-- ==================== LANES (Dirt Paths) ==================== -->
        <!-- Top lane -->
        <path d="M${blueLand.maxX - 150} ${H * 0.22} C${blueLand.maxX - 60} ${H * 0.20} ${riverLeft - 20} ${H * 0.18} ${riverCx} ${H * 0.16} C${riverRight + 20} ${H * 0.18} ${redLand.minX + 60} ${H * 0.20} ${redLand.minX + 150} ${H * 0.22}"
          fill="none" stroke="${laneBorder}" stroke-width="28" stroke-linecap="round" opacity=".35"/>
        <path d="M${blueLand.maxX - 150} ${H * 0.22} C${blueLand.maxX - 60} ${H * 0.20} ${riverLeft - 20} ${H * 0.18} ${riverCx} ${H * 0.16} C${riverRight + 20} ${H * 0.18} ${redLand.minX + 60} ${H * 0.20} ${redLand.minX + 150} ${H * 0.22}"
          fill="none" stroke="url(#moba-lane)" stroke-width="22" stroke-linecap="round" opacity=".7"/>

        <!-- Mid lane -->
        <path d="M${blueLand.maxX - 130} ${H * 0.5} L${riverLeft} ${H * 0.5} M${riverRight} ${H * 0.5} L${redLand.minX + 130} ${H * 0.5}"
          fill="none" stroke="${laneBorder}" stroke-width="30" stroke-linecap="round" opacity=".35"/>
        <path d="M${blueLand.maxX - 130} ${H * 0.5} L${riverLeft} ${H * 0.5} M${riverRight} ${H * 0.5} L${redLand.minX + 130} ${H * 0.5}"
          fill="none" stroke="url(#moba-lane)" stroke-width="24" stroke-linecap="round" opacity=".7"/>

        <!-- Bot lane -->
        <path d="M${blueLand.maxX - 150} ${H * 0.78} C${blueLand.maxX - 60} ${H * 0.80} ${riverLeft - 20} ${H * 0.82} ${riverCx} ${H * 0.84} C${riverRight + 20} ${H * 0.82} ${redLand.minX + 60} ${H * 0.80} ${redLand.minX + 150} ${H * 0.78}"
          fill="none" stroke="${laneBorder}" stroke-width="28" stroke-linecap="round" opacity=".35"/>
        <path d="M${blueLand.maxX - 150} ${H * 0.78} C${blueLand.maxX - 60} ${H * 0.80} ${riverLeft - 20} ${H * 0.82} ${riverCx} ${H * 0.84} C${riverRight + 20} ${H * 0.82} ${redLand.minX + 60} ${H * 0.80} ${redLand.minX + 150} ${H * 0.78}"
          fill="none" stroke="url(#moba-lane)" stroke-width="22" stroke-linecap="round" opacity=".7"/>

        <!-- Lane dust/wear marks -->
        <g fill="none" stroke="#e8d8a8" stroke-width="2" stroke-dasharray="3 12" opacity=".2" stroke-linecap="round">
          <path d="M${blueLand.maxX - 120} ${H * 0.5} L${riverLeft + 5} ${H * 0.5}"/>
          <path d="M${riverRight - 5} ${H * 0.5} L${redLand.minX + 120} ${H * 0.5}"/>
        </g>

        <!-- ==================== JUNGLE FORESTS ==================== -->
        ${grovesSvg}

        <!-- ==================== ROCKS & DETAILS ==================== -->
        ${rocksSvg}

        <!-- Grass blades -->
        ${grassSvg}

        <!-- Flowers -->
        ${flowersSvg}

        <!-- ==================== TERRITORY MARKERS ==================== -->
        <!-- Blue territory marker -->
        <g opacity=".75">
          <rect x="${(blueLand.minX + blueLand.maxX) / 2 - 70}" y="${H * 0.47}" width="140" height="28" rx="14" fill="#1a3a7a" opacity=".5"/>
          <text x="${(blueLand.minX + blueLand.maxX) / 2}" y="${H * 0.5 + 2}" text-anchor="middle" font-size="16" font-weight="bold" letter-spacing="4" fill="#6cb4f0" font-family="'Segoe UI', Arial, sans-serif" paint-order="stroke" stroke="#0a1a3a" stroke-width="3">BLUE</text>
        </g>
        <!-- Red territory marker -->
        <g opacity=".75">
          <rect x="${(redLand.minX + redLand.maxX) / 2 - 70}" y="${H * 0.47}" width="140" height="28" rx="14" fill="#7a2a1a" opacity=".5"/>
          <text x="${(redLand.minX + redLand.maxX) / 2}" y="${H * 0.5 + 2}" text-anchor="middle" font-size="16" font-weight="bold" letter-spacing="4" fill="#f06c6c" font-family="'Segoe UI', Arial, sans-serif" paint-order="stroke" stroke="#3a0a0a" stroke-width="3">RED</text>
        </g>

        <!-- ==================== MINI-MAP STYLE BORDER LINES ==================== -->
        <!-- Front lines (territory boundaries) - subtle MOBA-style -->
        <path d="M${blueLand.maxX} ${blueLand.minY} V${blueLand.maxY}" stroke="#4a90d9" stroke-width="2.5" stroke-dasharray="10 6" opacity=".35"/>
        <path d="M${redLand.minX} ${redLand.minY} V${redLand.maxY}" stroke="#d94a4a" stroke-width="2.5" stroke-dasharray="10 6" opacity=".35"/>
      </g>

      <!-- Island shoreline (clean crisp edge) -->
      <use href="#moba-coast" fill="none" stroke="#1a4a2a" stroke-width="3" stroke-linejoin="round" opacity=".6"/>

      <!-- Beach foam at the coast -->
      <use href="#moba-coast" fill="none" stroke="#a8d8e8" stroke-width="6" stroke-linejoin="round" opacity=".12"/>

      <!-- Vignette overlay for depth -->
      <rect ${full} fill="url(#moba-vignette)"/>
    </g>
  `);
}
