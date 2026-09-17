import type { BuildingType, Side } from '@arena-kingdom/shared';

/**
 * Battlefield symbols in the style of military situation maps (loosely NATO APP-6): the frame's
 * shape says what kind of thing it is and the mark inside says its role.
 *
 * - circle: places. Castle = capital star, village = gold.
 * - rectangle: military units. Troop = infantry cross, barracks = infantry cross on an installation.
 * - triangle: defensive post. Tower = observation post dot.
 * - line with teeth: obstacle. Fence, teeth facing the enemy.
 *
 * Each symbol is drawn at world size; `anchorY` is where the footprint centre sits in the image.
 * Keep the markup ASCII: it is Base64-encoded with `btoa`.
 */

export type SymbolType = BuildingType | 'troop';

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
  troop: { width: 30, height: 24, anchorY: 11 / 24 }
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
        `${frame('<circle cx="27" cy="27" r="22"/>', side, 2.6)}
        <text x="27" y="36.5" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="bold" font-size="27" fill="${ink}">$</text>`
      );
    case 'barracks':
      return svg(
        size,
        `${frame('<rect x="5" y="12" width="58" height="38"/>', side, 2.8)}
        <path d="${cross(5, 12, 58, 38)}" stroke="${ink}" stroke-width="2.6"/>
        <rect x="23" y="4.5" width="22" height="7.5" fill="${ink}"/>`
      );
    case 'tower':
      return svg(
        size,
        `${frame('<path d="M28 4L51 46H5Z"/>', side, 2.8)}
        <circle cx="28" cy="32" r="5" fill="${ink}"/>`
      );
    case 'fence': {
      // Teeth point towards the enemy: right for blue, left for red.
      const teeth = Array.from({ length: 8 }, (_, i) => `M17 ${10 + i * 16}L28 ${16 + i * 16}L17 ${22 + i * 16}Z`).join('');
      const body = `<path d="M17 6V134" fill="none" stroke="${HALO}" stroke-width="10" stroke-linecap="round"/>
        <g transform="translate(1.5 2.5)" opacity=".3"><path d="M17 6V134" stroke="${SHADOW}" stroke-width="6"/></g>
        <path d="M17 6V134" stroke="${ink}" stroke-width="6.5" stroke-linecap="round"/>
        <path d="M17 8V132" stroke="${COLORS[side].fill}" stroke-width="2.4"/>
        <path d="${teeth}" fill="${ink}" stroke="${HALO}" stroke-width="1" stroke-linejoin="round"/>`;
      return svg(size, side === 'blue' ? body : `<g transform="matrix(-1 0 0 1 ${size.width} 0)">${body}</g>`);
    }
    case 'troop':
      return svg(
        size,
        `${frame('<rect x="3" y="3" width="24" height="16"/>', side, 1.8)}
        <path d="${cross(3, 3, 24, 16)}" stroke="${ink}" stroke-width="1.6"/>`
      );
  }
}
