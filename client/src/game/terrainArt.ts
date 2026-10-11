import { MOUNTAIN_RIDGES } from '@arena-kingdom/shared';
import type { MapStyle } from './displaySettings';

export type ArtQuality = 'low' | 'medium' | 'high';

/** Includes temporary old/new terrain during swaps, plus the complete entity roster. */
export const GRAPHICS_TEXTURE_BUDGET = {
  low: { maxEdge: 1024, estimatedMaxMiB: 9 },
  medium: { maxEdge: 1536, estimatedMaxMiB: 19 },
  high: { maxEdge: 2048, estimatedMaxMiB: 33 }
} as const;

export function terrainRasterSize(width: number, height: number, quality: ArtQuality) {
  const edge = GRAPHICS_TEXTURE_BUDGET[quality].maxEdge;
  const scale = Math.min(1, edge / Math.max(1, width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** A single source for blocked terrain in every skin. The marked ellipse IS engine geometry. */
export function blockedRidgesArt(style: MapStyle) {
  const fantasy = style === 'moba';
  const stone = fantasy ? '#50616a' : style === 'vintage' ? '#8e7959' : '#77807a';
  const light = fantasy ? '#a2ad92' : '#c7bb97';
  return MOUNTAIN_RIDGES.map(({ cx, cy, rx, ry }, i) => {
    const facets = Array.from({ length: 7 }, (_, j) => {
      const x = -rx * .82 + j * rx * .24;
      const h = ry * (.72 + (j % 3) * .16);
      return `<path d="M${x} 5l${rx * .14} ${-h} ${rx * .17} ${h + ry * .6}Z" fill="${j % 2 ? '#394952' : stone}"/>
        <path d="M${x} 5l${rx * .14} ${-h} ${rx * .07} ${h * .58}Z" fill="${light}" opacity=".75"/>`;
    }).join('');
    return `<g data-blocked-ridge="${i}" data-footprint="${cx},${cy},${rx},${ry}" transform="translate(${cx} ${cy})">
      <defs><clipPath id="ridge-${i}"><ellipse rx="${rx}" ry="${ry}"/></clipPath></defs>
      <ellipse rx="${rx}" ry="${ry}" fill="#273b3c" stroke="${fantasy ? '#c5bd91' : '#453d31'}" stroke-width="2"/>
      <g clip-path="url(#ridge-${i})">
        <ellipse cy="${ry * .18}" rx="${rx}" ry="${ry}" fill="${stone}"/>
        ${facets}
        <path d="M${-rx} ${ry * .38}Q0 ${ry * .06} ${rx} ${ry * .5}" fill="none" stroke="#293d42" stroke-width="5"/>
        <path d="M${-rx * .85} ${-ry * .12}Q0 ${-ry * .5} ${rx * .65} ${-ry * .17}" fill="none" stroke="${light}" stroke-width="3"/>
        <path d="M${-rx * .65} ${ry * .4}l12-9 11 5m${rx * .8}-23l8-5 12 7" fill="none" stroke="${fantasy ? '#698360' : stone}" stroke-width="5"/>
      </g>
    </g>`;
  }).join('');
}
