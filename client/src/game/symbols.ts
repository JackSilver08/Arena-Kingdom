import type { BuildingType, Side } from '@arena-kingdom/shared';
import { knightIconDataUrl } from './knightIcon';

/**
 * Battlefield symbols in the style of military situation maps (loosely NATO APP-6): the frame's
 * shape says what kind of thing it is and the mark inside says its role.
 *
 * - circle: places. Castle = capital star.
 * - tent: settlement / camp glyph. Village = a standalone teepee; Barracks = a field-camp glyph.
 * - triangle: defensive post. Tower = observation post dot.
 * - line: obstacle. Fence = a bold defensive line with crossbars.
 * - shield: local defence. Militia = a small shield that only appears while a village garrison is active.
 *
 * Each symbol is drawn at world size; `anchorY` is where the footprint centre sits in the image.
 * Keep the markup ASCII: it is Base64-encoded with `btoa`.
 */

export type SymbolType = BuildingType | 'troop' | 'militia' | 'archer' | 'knight' | 'scout' | 'royal_guard' | 'cannon';

export interface SymbolSize {
  width: number;
  height: number;
  anchorY: number;
}

export const SYMBOL_SIZE: Record<SymbolType, SymbolSize> = {
  castle: { width: 100, height: 100, anchorY: 0.48 },
  village: { width: 54, height: 56, anchorY: 27 / 56 },
  barracks: { width: 68, height: 58, anchorY: 31 / 58 },
  tower: { width: 56, height: 54, anchorY: 32 / 54 },
  fence: { width: 34, height: 140, anchorY: 0.5 },
  troop: { width: 30, height: 24, anchorY: 11 / 24 },
  militia: { width: 22, height: 24, anchorY: 12 / 24 },
  archer: { width: 32, height: 26, anchorY: 13 / 26 },
  knight: { width: 36, height: 32, anchorY: 16 / 32 },
  scout: { width: 36, height: 32, anchorY: 16 / 32 },
  royal_guard: { width: 38, height: 34, anchorY: 17 / 34 },
  cannon: { width: 48, height: 35, anchorY: 17.5 / 35 }
};

export const COLORS: Record<Side, { fill: string; ink: string }> = {
  blue: { fill: '#9db9e2', ink: '#1b3764' },
  red: { fill: '#e7a296', ink: '#6f1f18' }
};
/** Paper-coloured halo that lifts a symbol off the map's lines and woods. */
const HALO = '#f3e8c8';
const SHADOW = '#2a1a0a';

const svg = ({ width, height }: SymbolSize, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${body}</svg>`;

/**
 * A frame drawn three times: a soft offset shadow printed on the paper, a paper halo, then the
 * filled frame with its ink outline.
 */
function frame(shape: string, side: Side, strokeWidth: number) {
  const { fill, ink } = COLORS[side];
  return `<g transform="translate(1.5 2.5)" fill="${SHADOW}" opacity=".3">${shape}</g>
    <g fill="none" stroke="${HALO}" stroke-width="${strokeWidth + 3.5}" stroke-linejoin="round">${shape}</g>
    <g fill="${fill}" stroke="${ink}" stroke-width="${strokeWidth}" stroke-linejoin="round">${shape}</g>`;
}

function star(cx: number, cy: number, outer: number, inner: number) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(cx + Math.cos(angle) * r).toFixed(1)} ${(cy + Math.sin(angle) * r).toFixed(1)}`;
  });
  return `M${points.join('L')}Z`;
}

/** The infantry cross: both diagonals of a rectangle. */
const cross = (x: number, y: number, w: number, h: number) => `M${x} ${y}L${x + w} ${y + h}M${x + w} ${y}L${x} ${y + h}`;

export function symbolArt(type: SymbolType, side: Side) {
  const size = SYMBOL_SIZE[type];
  const { ink } = COLORS[side];
  switch (type) {
    case 'castle':
      return svg(
        size,
        `${frame('<circle cx="50" cy="48" r="44"/>', side, 3.5)}
        <circle cx="50" cy="48" r="36" fill="none" stroke="${ink}" stroke-width="1.6" stroke-dasharray="5 3.5"/>
        <path d="${star(50, 50, 25, 10.5)}" fill="${ink}"/>`
      );
    case 'village':
      return svg(
        size,
        `<g fill="none" stroke="${SHADOW}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" opacity=".28" transform="translate(1.5 2.2)">
          <path d="M11 43 L27 15 L43 43 Z"/>
          <path d="M23 4 L31 16 M31 4 L23 16"/>
        </g>
        <g fill="none" stroke="${HALO}" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 43 L27 15 L43 43 Z"/>
          <path d="M23 4 L31 16 M31 4 L23 16"/>
        </g>
        <g fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 43 L27 15 L43 43 Z"/>
          <path d="M23 4 L31 16 M31 4 L23 16"/>
        </g>
        <path d="M27 26 L20 43 H34 Z" fill="${ink}" stroke="${HALO}" stroke-width="1.1" stroke-linejoin="round"/>`
      );
    case 'barracks':
      return svg(
        size,
        `${frame('<path d="M7 47 L23 15 L34 7 L45 15 L61 47 Z"/>', side, 2.8)}
        <g fill="none" stroke="${ink}" stroke-linecap="round" stroke-linejoin="round">
          <path d="M23 15 Q34 21 45 15" stroke-width="1.7" opacity=".82"/>
          <path d="M34 8 V45" stroke-width="1.7"/>
          <path d="M27 47 L34 29 L41 47" stroke-width="2.2"/>
          <path d="M8 47 Q34 50 60 47" stroke-width="2"/>
        </g>
        <path d="M34 8 V3.5" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M34 3.5 H45 L41.5 7 L45 10 H34 Z" fill="${ink}"/>`
      );
    case 'tower':
      return svg(
        size,
        `${frame('<path d="M28 4L51 46H5Z"/>', side, 2.8)}
        <circle cx="28" cy="32" r="5" fill="${ink}"/>`
      );
    case 'fence': {
      // Defensive-line glyph: one long bold vertical line with short perpendicular marks.
      // The repeated crossbars make the symbol read as a fortification line on the military map.
      const lineX = 17;
      const lineY1 = 7;
      const lineY2 = 133;
      const markYs = [18, 37, 56, 75, 94, 113, 128];
      const marks = markYs.map((y) => `M9 ${y} H25`).join('');
      const shadow = `<path d="M${lineX} ${lineY1} V${lineY2}" stroke="${SHADOW}" stroke-width="7" stroke-linecap="round"/>
        <path d="${marks}" stroke="${SHADOW}" stroke-width="3.1" stroke-linecap="round"/>`;
      const halo = `<path d="M${lineX} ${lineY1} V${lineY2}" stroke="${HALO}" stroke-width="9" stroke-linecap="round"/>
        <path d="${marks}" stroke="${HALO}" stroke-width="5.2" stroke-linecap="round"/>`;
      const inkLine = `<path d="M${lineX} ${lineY1} V${lineY2}" stroke="${ink}" stroke-width="5.4" stroke-linecap="round"/>
        <path d="${marks}" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`;
      return svg(size, `${shadow}${halo}${inkLine}`);
    }
    case 'troop':
      return svg(
        size,
        `${frame('<rect x="3" y="3" width="24" height="16"/>', side, 1.8)}
        <path d="${cross(3, 3, 24, 16)}" stroke="${ink}" stroke-width="1.6"/>`
      );
    case 'militia':
      return svg(
        size,
        `<g fill="none" stroke="${SHADOW}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" opacity=".28" transform="translate(1.2 1.8)">
          <path d="M4 5 L11 2 L18 5 V11 C18 17 15 20 11 22 C7 20 4 17 4 11 Z"/>
          <path d="M11 7 V16 M8 10 H14"/>
        </g>
        <g fill="${HALO}" stroke="${HALO}" stroke-width="5.2" stroke-linejoin="round" stroke-linecap="round">
          <path d="M4 5 L11 2 L18 5 V11 C18 17 15 20 11 22 C7 20 4 17 4 11 Z"/>
          <path d="M11 7 V16 M8 10 H14" fill="none"/>
        </g>
        <g fill="${COLORS[side].fill}" stroke="${ink}" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round">
          <path d="M4 5 L11 2 L18 5 V11 C18 17 15 20 11 22 C7 20 4 17 4 11 Z"/>
          <path d="M11 7 V16 M8 10 H14" fill="none"/>
        </g>`
      );
    case 'archer':
      return svg(
        size,
        `${frame('<rect x="2" y="3" width="28" height="20"/>', side, 1.8)}
        <path d="M9 7 Q22 13 9 19" fill="none" stroke="${ink}" stroke-width="1.8"/>
        <path d="M9 13 H24" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M24 13 L20.5 10.8 M24 13 L20.5 15.2" stroke="${ink}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`
      );
    case 'knight':
      // Use the supplied raster glyph directly instead of approximating the chess knight with SVG paths.
      return svg(
        size,
        `<image href="${knightIconDataUrl(side)}" x="0" y="0" width="${size.width}" height="${size.height}" preserveAspectRatio="xMidYMid meet"/>`
      );
    case 'scout':
      // Battlefield Scout = military unit frame with a single reconnaissance eye inside.
      return svg(
        size,
        `${frame('<rect x="3" y="3" width="30" height="26" rx="2"/>', side, 2.2)}
        <path d="M8.5 16 Q18 7.5 27.5 16 Q18 24.5 8.5 16 Z"
          fill="none" stroke="${HALO}" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8.5 16 Q18 7.5 27.5 16 Q18 24.5 8.5 16 Z"
          fill="${COLORS[side].fill}" stroke="${ink}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="18" cy="16" r="3.1" fill="${ink}"/>
        <circle cx="19" cy="15" r=".8" fill="#ffffff" opacity=".9"/>`
      );
    case 'royal_guard':
      // Royal Guard = a distinctive elite castle defender:
      // same circular frame language as the Castle, but with the Castle's star reduced inside it.
      return svg(
        size,
        `${frame('<circle cx="19" cy="17" r="15.2"/>', side, 2.4)}
        <circle cx="19" cy="17" r="10.8" fill="none" stroke="${ink}" stroke-width="1.2" stroke-dasharray="3 2.2"/>
        <path d="${star(19, 17, 7.8, 3.3)}" fill="${ink}"/>`
      );
  }
}
