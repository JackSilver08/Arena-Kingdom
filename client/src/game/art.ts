import type { BuildingType, Side } from '@arena-kingdom/shared';

/**
 * Vector art for the battlefield and HUD. Each function returns a standalone SVG
 * (viewBox only), used both as Phaser textures and inline in the DOM.
 */

const INK = '#1f2937';
const TEAM: Record<Side, { main: string; dark: string; light: string }> = {
  blue: { main: '#3b82f6', dark: '#1d4ed8', light: '#93c5fd' },
  red: { main: '#ef4444', dark: '#b91c1c', light: '#fca5a5' }
};

export interface ArtSize {
  width: number;
  height: number;
}

/** Display size of each sprite in world pixels. */
export const SPRITE_SIZE: Record<BuildingType | 'troop', ArtSize> = {
  castle: { width: 120, height: 116 },
  village: { width: 66, height: 58 },
  barracks: { width: 66, height: 62 },
  fence: { width: 132, height: 46 },
  tower: { width: 48, height: 74 },
  troop: { width: 26, height: 36 }
};

/** Vertical anchor of each sprite: the building's footprint centre sits this far down the image. */
export const SPRITE_ANCHOR_Y: Record<BuildingType | 'troop', number> = {
  castle: 0.6,
  village: 0.58,
  barracks: 0.58,
  fence: 0.6,
  tower: 0.7,
  troop: 0.72
};

const svg = (viewBox: string, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;

export function castleArt(side: Side) {
  const t = TEAM[side];
  return svg(
    '0 0 120 116',
    `<g stroke="#475569" stroke-width="2.5" stroke-linejoin="round">
      <rect x="22" y="58" width="76" height="52" fill="#cbd5e1"/>
      <rect x="8" y="38" width="26" height="72" fill="#e2e8f0"/>
      <rect x="86" y="38" width="26" height="72" fill="#e2e8f0"/>
      <rect x="40" y="30" width="40" height="80" fill="#f1f5f9"/>
      <path d="M5 40 L21 6 L37 40 Z" fill="${t.main}"/>
      <path d="M83 40 L99 6 L115 40 Z" fill="${t.main}"/>
      <path d="M35 32 L60 2 L85 32 Z" fill="${t.main}"/>
    </g>
    <path d="M21 8 L35 39 L26 39 Z" fill="${t.dark}" opacity=".45"/>
    <path d="M99 8 L113 39 L104 39 Z" fill="${t.dark}" opacity=".45"/>
    <path d="M60 4 L83 31 L70 31 Z" fill="${t.dark}" opacity=".45"/>
    <g fill="#475569">
      <rect x="17" y="52" width="8" height="12" rx="4"/>
      <rect x="95" y="52" width="8" height="12" rx="4"/>
      <rect x="56" y="42" width="8" height="12" rx="4"/>
    </g>
    <path d="M48 110 V91 a12 12 0 0 1 24 0 V110 Z" fill="#64748b" stroke="#334155" stroke-width="2.5"/>
    <path d="M60 81 V110" stroke="#334155" stroke-width="1.5"/>
    <g stroke="#94a3b8" stroke-width="2" stroke-linecap="round">
      <path d="M12 80 h8 M22 96 h8 M90 76 h8 M98 94 h8 M44 66 h8 M68 72 h8 M27 70 h6 M88 102 h6"/>
    </g>`
  );
}

function house(x: number, y: number, w: number, h: number, wall: string, roof: string, door: string) {
  const roofH = h * 0.46;
  return `<g stroke="${INK}" stroke-width="2" stroke-linejoin="round">
    <rect x="${x + w * 0.12}" y="${y + roofH - 2}" width="${w * 0.76}" height="${h - roofH + 2}" fill="${wall}"/>
    <path d="M${x} ${y + roofH} L${x + w / 2} ${y} L${x + w} ${y + roofH} Z" fill="${roof}"/>
    <rect x="${x + w * 0.42}" y="${y + h * 0.66}" width="${w * 0.18}" height="${h * 0.34}" fill="${door}"/>
  </g>`;
}

export function villageArt() {
  return svg(
    '0 0 66 58',
    `${house(1, 6, 28, 30, '#60a5fa', '#1e40af', '#dc2626')}
    ${house(35, 2, 28, 30, '#86efac', '#15803d', '#1e3a8a')}
    ${house(15, 20, 34, 36, '#f5d0a9', '#b45309', '#dc2626')}
    <rect x="22" y="40" width="6" height="6" fill="#93c5fd" stroke="${INK}" stroke-width="1.5"/>`
  );
}

export function barracksArt(side: Side) {
  const t = TEAM[side];
  return svg(
    '0 0 66 62',
    `<path d="M37 3 V20" stroke="#374151" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M38 3 h14 l-4 4.5 l4 4.5 h-14 z" fill="${t.main}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M6 28 L33 15 L60 28 V54 H6 Z" fill="#f3f4f6" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M6 28 L33 15 L60 28" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="21" y="34" width="24" height="20" fill="#111827"/>
    <path d="M21 39 h24 M21 44 h24 M21 49 h24" stroke="#374151" stroke-width="1.2"/>
    <rect x="10" y="34" width="7" height="7" fill="#9ca3af" stroke="${INK}" stroke-width="1.5"/>
    <rect x="49" y="34" width="7" height="7" fill="#9ca3af" stroke="${INK}" stroke-width="1.5"/>
    <rect x="6" y="53" width="54" height="4" fill="${t.main}"/>
    <rect x="6" y="57" width="54" height="3" fill="${t.dark}"/>`
  );
}

export function troopArt(side: Side) {
  const t = TEAM[side];
  return svg(
    '0 0 26 36',
    `<path d="M4 2 H22 V33 L13 26 L4 33 Z" fill="${t.main}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M8 7 H18" stroke="${t.light}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M22 2 V33 L13 26 V2 Z" fill="${t.dark}" opacity=".25"/>`
  );
}

export function fenceArt() {
  let stakes = '';
  for (let i = 0; i < 12; i++) {
    const x = 1 + i * 10.8;
    stakes += `<path d="M${x} 44 V11 L${x + 4.5} 3 L${x + 9} 11 V44 Z"/>`;
  }
  return svg(
    '0 0 132 46',
    `<g fill="#c08448" stroke="#6b3f1d" stroke-width="1.6" stroke-linejoin="round">${stakes}</g>
    <g fill="#8b5a2b" stroke="#5b3413" stroke-width="1.5">
      <rect x="0.8" y="16" width="130.4" height="5"/>
      <rect x="0.8" y="32" width="130.4" height="5"/>
    </g>`
  );
}

export function towerArt(side: Side) {
  const t = TEAM[side];
  return svg(
    '0 0 48 74',
    `<path d="M24 2 V10" stroke="#374151" stroke-width="2"/>
    <path d="M25 2 h10 l-3 3 l3 3 h-10 z" fill="${t.main}" stroke="${INK}" stroke-width="1.3"/>
    <rect x="12" y="30" width="24" height="42" fill="#e2e8f0" stroke="#475569" stroke-width="2.5"/>
    <rect x="8" y="26" width="32" height="7" fill="#cbd5e1" stroke="#475569" stroke-width="2"/>
    <path d="M8 28 L24 8 L40 28 Z" fill="${t.main}" stroke="${t.dark}" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="20" y="40" width="8" height="12" rx="4" fill="#475569"/>
    <path d="M15 62 h6 M27 56 h6" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>`
  );
}

export function buildingArt(type: BuildingType, side: Side) {
  switch (type) {
    case 'castle':
      return castleArt(side);
    case 'village':
      return villageArt();
    case 'barracks':
      return barracksArt(side);
    case 'fence':
      return fenceArt();
    case 'tower':
      return towerArt(side);
  }
}

export const WAVE_SIZE = { big: { width: 380, height: 180 }, small: { width: 260, height: 64 } };

export function bigWaveArt() {
  return svg(
    '0 0 380 180',
    `<g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">
      <path stroke-width="6" d="M16 118 C70 112 110 88 142 48 C166 18 214 4 246 18 C272 30 274 62 248 66 C228 69 220 48 238 42"/>
      <path stroke-width="5" d="M118 104 C140 84 152 62 168 44"/>
      <path stroke-width="6" d="M52 146 C112 138 162 128 204 98 C228 82 262 82 284 98 C302 111 336 110 356 96"/>
      <path stroke-width="5" d="M96 170 C156 160 214 158 256 166 C290 172 326 168 360 156"/>
      <path stroke-width="4" d="M290 70 C306 58 326 60 336 72"/>
    </g>`
  );
}

export function smallWaveArt() {
  return svg(
    '0 0 260 64',
    `<g fill="none" stroke="#fff" stroke-linecap="round">
      <path stroke-width="5" d="M6 30 C42 12 74 12 104 26 S166 42 206 22 S244 14 254 20"/>
      <path stroke-width="4.5" d="M34 50 C64 38 94 40 124 48 S186 56 226 42"/>
    </g>`
  );
}

// ------------------------------------------------------------------ HUD icons

export function moneyBagIcon() {
  return svg(
    '0 0 48 48',
    `<path d="M17 4 h14 l-4 8 h-6 z" fill="#b45309" stroke="#78350f" stroke-width="2" stroke-linejoin="round"/>
    <path d="M20 12 h8 c10 6 15 14 15 21 c0 9 -8 12 -19 12 s-19 -3 -19 -12 c0 -7 5 -15 15 -21 z" fill="#f59e0b" stroke="#92400e" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M28.5 25 c-1-2-3-3-5-3 c-3 0-5 1.5-5 4 c0 5 10 3 10 8 c0 2.5-2 4-5 4 c-2.5 0-4.5-1-5.5-3 M23.5 19 v3 M23.5 38 v3" fill="none" stroke="#78350f" stroke-width="2.6" stroke-linecap="round"/>`
  );
}

export function bannerIcon() {
  return svg('0 0 48 48', `<path d="M11 4 H37 V44 L24 34 L11 44 Z" fill="#fff" stroke="#111" stroke-width="3.2" stroke-linejoin="round"/>`);
}

export function houseIcon() {
  return svg(
    '0 0 48 48',
    `<path d="M24 5 L4 23 h6 v20 h28 V23 h6 Z" fill="#fde7c2" stroke="#7c2d12" stroke-width="2" stroke-linejoin="round"/>
    <path d="M24 3 L2 23 L7 27 L24 11 L41 27 L46 23 Z" fill="#f97316" stroke="#9a3412" stroke-width="2" stroke-linejoin="round"/>
    <rect x="12" y="28" width="9" height="8" fill="#60a5fa" stroke="#7c2d12" stroke-width="1.6"/>
    <rect x="27" y="29" width="8" height="14" fill="#92400e"/>
    <rect x="33" y="8" width="5" height="9" fill="#b91c1c"/>`
  );
}

export function hammerIcon() {
  return svg(
    '0 0 100 100',
    `<path d="M40 44 L12 90 a6 6 0 0 0 10 6 L50 50 Z" fill="#facc15" stroke="#a16207" stroke-width="3" stroke-linejoin="round"/>
    <path d="M30 26 L58 8 L66 18 L92 30 L86 42 L64 36 L54 52 L34 40 Z" fill="#6b7280" stroke="#374151" stroke-width="3" stroke-linejoin="round"/>
    <path d="M58 8 L66 18 L60 30" fill="none" stroke="#9ca3af" stroke-width="3" stroke-linecap="round"/>`
  );
}

export function helmetIcon() {
  return svg(
    '0 0 100 100',
    `<path d="M14 62 C14 28 34 14 52 14 C72 14 90 30 90 62 Z" fill="#5b7a3a" stroke="#344a20" stroke-width="3" stroke-linejoin="round"/>
    <path d="M6 64 C30 56 74 56 96 64 C96 70 90 72 84 70 C62 64 38 64 16 70 C10 72 6 70 6 64 Z" fill="#4d6a2f" stroke="#344a20" stroke-width="3" stroke-linejoin="round"/>
    <path d="M30 26 C38 20 48 18 56 19" fill="none" stroke="#86a95e" stroke-width="4" stroke-linecap="round"/>
    <path d="M22 70 L18 92" stroke="#3f3f22" stroke-width="4" stroke-linecap="round"/>`
  );
}

export function envelopeIcon() {
  return svg(
    '0 0 100 100',
    `<rect x="6" y="20" width="88" height="62" fill="#fbbf57" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M6 20 L50 58 L94 20" fill="none" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M6 82 L38 48 M94 82 L62 48" fill="none" stroke="#111" stroke-width="3.5" stroke-linecap="round"/>`
  );
}

export function svgDataUrl(markup: string, width: number, height: number) {
  const sized = markup.replace('<svg ', `<svg width="${Math.round(width)}" height="${Math.round(height)}" `);
  // Phaser treats `data:` URLs handed to its loader as Base64 input. A
  // percent-encoded URL therefore reaches `atob` and prevents the whole scene
  // from booting. The artwork itself is ASCII SVG, so a Base64 data URL is both
  // safe here and works with Phaser's SVG texture loader.
  return `data:image/svg+xml;base64,${btoa(sized)}`;
}
