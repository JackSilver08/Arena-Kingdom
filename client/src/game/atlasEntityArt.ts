import type { BuildingType, Side, UnitType } from '@arena-kingdom/shared';
import type { SymbolSize } from './symbols';
import { ATLAS_COLORS as C } from './atlasStyle';

// Historical atlas architecture and military counters, P2 revision.
// Silhouettes are identical for both teams; only pennants/counter trim vary.
export type AtlasEntity = BuildingType | UnitType;
export const ATLAS_ENTITY_VERSION = 2;
export const ATLAS_SIZE: Record<AtlasEntity, SymbolSize> = {
  soldier: { width: 46, height: 30, anchorY: .5 },
  militia: { width: 46, height: 30, anchorY: .5 },
  archer: { width: 46, height: 30, anchorY: .5 },
  knight: { width: 50, height: 32, anchorY: .5 },
  scout: { width: 44, height: 30, anchorY: .5 },
  royal_guard: { width: 50, height: 32, anchorY: .5 },
  cannon: { width: 50, height: 32, anchorY: .5 },
  castle: { width: 112, height: 124, anchorY: .83 },
  village: { width: 66, height: 65, anchorY: .83 },
  barracks: { width: 76, height: 77, anchorY: .84 },
  tower: { width: 47, height: 90, anchorY: .86 },
  fence: { width: 27, height: 140, anchorY: .5 }
};
const INK = C.ink;
const MUTED = C.inkSoft;
const PAPER = C.paperLight;
const STONE = '#d3c6ac';
const SHADE = '#a89b81';
const ROOF = '#ae684f';
const ROOF_LIGHT = '#d09b77';
const WOOD = '#ad8861';
const team = (side: Side) => side === 'blue' ? C.blue : C.red;
const flag = (side: Side, x: number, y: number, length = 16) => `
  <path d="M${x} ${y}v${length + 10}" fill="none" stroke="${INK}" stroke-width="1.8"/>
  <path data-team-accent="banner" d="M${x + 1} ${y + 1}q8-5 16 0l-4 5 5 5q-7-4-17 0Z" fill="${team(side)}" stroke="${INK}" stroke-width="1.3"/>`;
const footprint = (rx = 36) => `<ellipse cx="50" cy="91" rx="${rx}" ry="5" fill="#665139" opacity=".13"/>`;
const masonry = (d: string) => `<path d="${d}" fill="none" stroke="${MUTED}" stroke-width="1.3" opacity=".77"/>`;
const windowSlot = (x: number, y: number) => `<path d="M${x} ${y + 12}v-8q4-7 8 0v8Z" fill="#70604c" stroke="${INK}" stroke-width="1.4"/>`;
const scratch = (x: number, y: number) => `<path d="M${x} ${y}l6-2m-3 5 6-1m-8 6 5-1" fill="none" stroke="${MUTED}" stroke-width=".8" opacity=".65"/>`;

function cottage(x: number, y: number, s = 1, chimney = false) {
  return `<g transform="translate(${x} ${y}) scale(${s})" stroke-linejoin="round" stroke-linecap="round">
    <path d="M0 18L18 8 36 19v24l-18 5L0 42Z" fill="${STONE}" stroke="${INK}" stroke-width="2.2"/>
    <path d="M-2 18L18 0l21 18-5 5-16-15-16 15Z" fill="${ROOF}" stroke="${INK}" stroke-width="2.1"/>
    <path d="M7 16L18 6l10 10" fill="none" stroke="${ROOF_LIGHT}" stroke-width="1.6"/>
    <path d="M23 47V30q5-6 10 0v15" fill="#705138" stroke="${INK}" stroke-width="1.3"/>
    <rect x="6" y="28" width="9" height="8" fill="#8b8d7a" stroke="${INK}" stroke-width="1.1"/>
    ${chimney ? `<path d="M25 7V-4h7v17" fill="${STONE}" stroke="${INK}" stroke-width="1.5"/><path d="M30-7q-5-3-1-7" fill="none" stroke="${MUTED}" opacity=".5"/>` : ''}
    ${scratch(5, 39)}
  </g>`;
}
function castle(side: Side) {
  return footprint(44) + `<g data-landmark="castle" stroke-linejoin="round" stroke-linecap="round">
    <path d="M5 76l43-16 47 16v15l-44 5-46-5Z" fill="#b3a387" stroke="${INK}" stroke-width="2.3"/>
    <path d="M15 41H86v47l-36 4-35-4Z" fill="${STONE}" stroke="${INK}" stroke-width="2.7"/>
    <path d="M17 49h67M16 71l67-2" fill="none" stroke="${MUTED}" stroke-width="1.4" opacity=".52"/>
    <path d="M36 29H65v56H36Z" fill="#c6b598" stroke="${INK}" stroke-width="2.5"/>
    <path d="M33 31l17-19 18 19-5 4-13-14-13 14Z" fill="${ROOF}" stroke="${INK}" stroke-width="2.3"/>
    <path d="M5 31h27v56l-13 4-14-4ZM69 31h27v56l-13 4-14-4Z" fill="${STONE}" stroke="${INK}" stroke-width="2.4"/>
    <path d="M3 31l16-21 16 21-4 4-12-14-12 14ZM66 31l16-21 17 21-4 4-13-14-12 14Z" fill="${ROOF}" stroke="${INK}" stroke-width="2.5"/>
    <path d="M8 25l11-13 10 13M71 25l11-13 11 13" fill="none" stroke="${ROOF_LIGHT}" stroke-width="1.5"/>
    <path d="M38 90V72q12-16 25 0v18Z" fill="#73563d" stroke="${INK}" stroke-width="2.5"/>
    <path d="M50 64v25m-11-13h24" fill="none" stroke="#d5b88a" stroke-width="1.2"/>
    ${windowSlot(12,48)}${windowSlot(78,48)}${windowSlot(46,37)}
    ${masonry('M7 68h12m-8 7h9m50-9h10m-4 9h13M35 55h10m12 2h8M25 84l7-2')}
    ${flag(side,50,1,16)}${flag(side,19,8,10)}${flag(side,82,8,10)}
    <path d="M7 94q43 5 86-1" fill="none" stroke="${MUTED}" stroke-width="1.3" stroke-dasharray="6 4"/>
  </g>`;
}
function village(side: Side) {
  return footprint(40) + `<g data-landmark="village">
    <path d="M5 84q23-7 40-4t49 4" fill="none" stroke="#9f9877" stroke-width="2"/>
    ${cottage(4,28,.92,true)}${cottage(44,20,.81)}${cottage(28,45,.82)}
    <path d="M73 68v17m7-15v16m7-12v13m-16-11 20 3M12 84v7m8-8v8m-11-2 16-1" fill="none" stroke="#84694b" stroke-width="1.8"/>
    <path d="M6 63q4-6 8-2m-3 5 8 2M75 54q8-4 14 1" fill="none" stroke="#6c855e" stroke-width="1.5"/>
    ${flag(side,76,31,13)}
  </g>`;
}
function barracks(side: Side) {
  return footprint(45) + `<g data-landmark="barracks" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 78l46-14 45 14v15l-45 4-46-5Z" fill="#b8a387" stroke="${INK}" stroke-width="2.1"/>
    ${Array.from({length:8},(_,i)=>{const x=5+i*12;return `<path d="M${x} 67v20l5-4v-16l-2-7Z" fill="${WOOD}" stroke="${INK}" stroke-width="1.2"/>`;}).join('')}
    <path d="M16 35h68v49l-33 6-35-5Z" fill="${STONE}" stroke="${INK}" stroke-width="2.4"/>
    <path d="M11 36L50 11l40 25-6 7-34-23-32 23Z" fill="${ROOF}" stroke="${INK}" stroke-width="2.5"/>
    <path d="M19 33l30-18 30 18" fill="none" stroke="${ROOF_LIGHT}" stroke-width="1.8"/>
    <path d="M37 87V56q14-12 29 0v31Z" fill="#856444" stroke="${INK}" stroke-width="2"/>
    <path d="M38 63h27m-24 7h23m-25 8h25m-13-23v31" stroke="#d4ad75" stroke-width="1.7"/>
    <path d="M24 52l11 15m0-15L24 67" fill="none" stroke="${INK}" stroke-width="3"/>
    <path d="M22 48l4 2-2 4m11-6-4 2 2 4" fill="${PAPER}" stroke="${INK}" stroke-width="1.2"/>
    ${masonry('M66 50l12 1m-7 7 9-1M19 77l10 2')}
    ${flag(side,49,1,18)}
    <path data-team-accent="standard" d="M79 51h10v16l-5 4-5-4Z" fill="${team(side)}" stroke="${INK}" stroke-width="1.1"/>
    <path d="M82 56l4 7m0-7-4 7" stroke="${PAPER}" stroke-width="1.4"/>
  </g>`;
}
function tower(side: Side) {
  return footprint(29) + `<g data-landmark="tower" stroke-linejoin="round" stroke-linecap="round">
    <path d="M31 28h38l-3 58-17 6-16-6Z" fill="${STONE}" stroke="${INK}" stroke-width="2.5"/>
    <path d="M51 30h18l-3 56-15 5Z" fill="${SHADE}" opacity=".63"/>
    <path d="M26 27V17h9v7h10v-7h9v7h10v-7h9v13H26Z" fill="#d1c5ad" stroke="${INK}" stroke-width="2.3"/>
    <path d="M29 18L49 4l21 14" fill="none" stroke="${INK}" stroke-width="2.4"/>
    <path d="M34 17 49 7l16 10" stroke="${ROOF_LIGHT}" stroke-width="1.2" fill="none"/>
    ${windowSlot(37,39)}${windowSlot(54,52)}
    <path d="M43 89V76q6-8 13 0v13Z" fill="#73563d" stroke="${INK}" stroke-width="1.9"/>
    ${masonry('M35 64h10m12 7 7-1m-29 9 6-2M56 36h9')}
    <path d="M30 91q22 4 41 0" fill="none" stroke="${MUTED}" stroke-width="1.3"/>
    ${flag(side,51,-1,20)}
  </g>`;
}
function fence(side: Side) {
  const stakes = Array.from({length:8},(_,i)=>{
    const y=5+i*11;return `<path d="M34 ${y+7}v-10L49 ${y-8} 65 ${y-3}v10l-16-5Z" fill="${i%2?'#ba9470':'#cca780'}" stroke="${INK}" stroke-width="1.5"/>
      <path d="M49 ${y-7}v9" stroke="#e0c39a" stroke-width="1.1"/>`;
  }).join('');
  return `<g data-landmark="fence">
    <path d="M31 0h36v98H31Z" fill="#b3906c" opacity=".66" stroke="${INK}" stroke-width="1.2"/>
    ${stakes}
    <path d="M32 25h36m-36 40h36" fill="none" stroke="${INK}" stroke-width="4"/>
    <path data-team-accent="fence-ribbons" d="M33 24h34v5H33Zm0 40h34v5H33Z" fill="${team(side)}" opacity=".9"/>
  </g>`;
}
export function atlasUnitGlyph(type: UnitType): string {
  const stroke=`fill="none" stroke="${INK}" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"`;
  switch(type) {
    case 'soldier':return `<g data-counter-glyph="swords"><path d="M30 26l39 40m-40 0 40-40" ${stroke}/><path d="M25 22l12 3-9 9m46-12-12 3 9 9M26 62l7 8m41-8-7 8" ${stroke}/></g>`;
    case 'militia':return `<g data-counter-glyph="shield-spear"><path d="M38 26l12-8 16 8v24q-6 14-16 19-11-5-16-19V26Z" ${stroke}/><path d="M29 18l42 54m-45-56 9 0-8 8M69 72l-9 1" ${stroke}/></g>`;
    case 'archer':return `<g data-counter-glyph="bow"><path d="M39 19q26 24 0 51M36 18v53M34 44h40m-11-9 11 9-11 9" ${stroke}/><path d="M51 42l10-6" stroke="${MUTED}" stroke-width="1.8"/></g>`;
    case 'knight':return `<g data-counter-glyph="horse"><path d="M27 70l9-17-3-13 13-18 11 9 14-4 5 13-10 8 4 21Z" ${stroke}/><path d="M35 70h42M43 40h3M60 29l6-12m-4 36v15" ${stroke}/></g>`;
    case 'scout':return `<g data-counter-glyph="eye"><path d="M20 47q30-29 60 0-29 29-60 0Z" ${stroke}/><circle cx="50" cy="47" r="11" ${stroke}/><circle cx="50" cy="47" r="4.6" fill="${INK}"/></g>`;
    case 'royal_guard':return `<g data-counter-glyph="crown"><path d="M25 29l13 9 12-17 13 17 13-9-7 32H32Z" ${stroke}/><path d="M29 68h43M50 39v13m-6-7h12" ${stroke}/></g>`;
    case 'cannon':return `<g data-counter-glyph="cannon"><path d="M18 32l53-12 8 15-50 15-11-7Z" ${stroke}/><path d="M29 51l-8 16h57" ${stroke}/><circle cx="43" cy="64" r="11" ${stroke}/><circle cx="43" cy="64" r="3" fill="${INK}"/></g>`;
  }
}
function counter(type: UnitType, side: Side) {
  const accent=team(side);
  return `<g data-counter-type="${type}" stroke-linejoin="round" stroke-linecap="round">
    <path d="M6 18h88v64H6Z" fill="#604b39" opacity=".17" transform="translate(1.2 2)"/>
    <path d="M5 14h90v65H5Z" fill="${PAPER}" stroke="${INK}" stroke-width="2.3"/>
    <path d="M9 18h82v56H9Z" fill="none" stroke="#93816c" stroke-width="1.25"/>
    <path data-team-accent="counter-frame" d="M6 15h88v8H6Zm0 56h88v8H6Z" fill="${accent}"/>
    <path d="M13 27h13m48 0h13M12 65h10m56 0h10" fill="none" stroke="${MUTED}" stroke-width="1" opacity=".5"/>
    ${atlasUnitGlyph(type)}
    <path d="M45 72h10m-24 0h7m24 0h7" fill="none" stroke="${PAPER}" stroke-width="2.1" opacity=".9"/>
    <path data-team-accent="counter-pennant" d="M8 14v13l8-7Zm84 0v13l-8-7Z" fill="${accent}" stroke="${INK}" stroke-width=".6"/>
  </g>`;
}
export function atlasEntityArt(type: AtlasEntity, side: Side): string {
  const body=(()=>{
    switch(type) {
      case 'castle':return castle(side);
      case 'village':return village(side);
      case 'barracks':return barracks(side);
      case 'tower':return tower(side);
      case 'fence':return fence(side);
      default:return counter(type,side);
    }
  })();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"
    data-entity="${type}" data-team="${side}" data-art="campaign-engraved-v2"
    data-entity-version="${ATLAS_ENTITY_VERSION}">${body}</svg>`;
}
