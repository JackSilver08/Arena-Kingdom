import type { BuildingType, Side, UnitType } from '@arena-kingdom/shared';
import type { SymbolSize } from './symbols';

export type AtlasEntity = BuildingType | UnitType;
export const ATLAS_SIZE: Record<AtlasEntity, SymbolSize> = {
  soldier: { width: 38, height: 30, anchorY: .5 },
  militia: { width: 38, height: 30, anchorY: .5 },
  archer: { width: 38, height: 30, anchorY: .5 },
  knight: { width: 42, height: 32, anchorY: .5 },
  scout: { width: 38, height: 30, anchorY: .5 },
  royal_guard: { width: 42, height: 34, anchorY: .5 },
  cannon: { width: 42, height: 32, anchorY: .5 },
  castle: { width: 112, height: 124, anchorY: .83 },
  village: { width: 66, height: 65, anchorY: .83 },
  barracks: { width: 76, height: 77, anchorY: .84 },
  tower: { width: 47, height: 90, anchorY: .86 },
  fence: { width: 27, height: 140, anchorY: .5 }
};

const INK = '#49392a';
const STONE = '#d1bfa0';
const SHADE = '#95846c';
const ROOF = '#ad6342';
const PARCHMENT = '#f5e7c7';
const team = (side: Side) => side === 'blue' ? '#315e8e' : '#a34639';
const cloth = (side: Side) => side === 'blue' ? '#97b2c8' : '#cf8771';
const flag = (x: number, y: number, side: Side) =>
  '<path d="M' + x + ' ' + y + 'v24" fill="none" stroke="' + INK + '" stroke-width="2"/>'
  + '<path data-team-accent="flag" d="M' + (x+1) + ' ' + y + 'q11-5 18 1l-4 7q-8-5-14-1Z" fill="' + team(side) + '" stroke="' + INK + '" stroke-width="1.7"/>';
const stoneLines = '<path d="M14 67l10-2m26 6 15-2m-40-11 12-1m30-13 8 1M40 79l14-2" fill="none" stroke="#73664e" stroke-width="1.3" opacity=".68"/>';
const shadow = '<ellipse cx="51" cy="91" rx="39" ry="7" fill="#5c4c35" opacity=".15"/>';
const house = (x: number, y: number, s: number) => '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">'
  + '<path d="M2 22h33v26L18 52 2 48Z" fill="' + STONE + '" stroke="' + INK + '" stroke-width="2"/>'
  + '<path d="M1 22L17 3l20 19-4 6-17-15L5 28Z" fill="' + ROOF + '" stroke="' + INK + '" stroke-width="2"/>'
  + '<path d="M21 46V31q5-7 10 0v16" fill="#6e5239" stroke="' + INK + '" stroke-width="1.5"/>'
  + '<rect x="6" y="31" width="8" height="7" fill="#e6d59c" stroke="' + INK + '" stroke-width="1.3"/>'
  + '<path d="M6 19l11-13 13 14" stroke="#dca67a" stroke-width="1.3" fill="none"/></g>';

function castle(side: Side) {
  return shadow
    + '<path d="M7 75L52 57 94 76v16H7Z" fill="#93836a" stroke="' + INK + '" stroke-width="2"/>'
    + '<path d="M15 49h72v37l-35 6-37-7Z" fill="' + STONE + '" stroke="' + INK + '" stroke-width="2.5"/>'
    + '<path d="M35 35h34v46H35Z" fill="#c4ae8b" stroke="' + INK + '" stroke-width="2"/>'
    + '<path d="M32 35L50 9l22 26-7 4-15-22-12 23Z" fill="' + ROOF + '" stroke="' + INK + '" stroke-width="2"/>'
    + '<path d="M6 45h28v40l-14 4-14-4Zm61 0h28v40l-14 4-14-4Z" fill="' + STONE + '" stroke="' + INK + '" stroke-width="2.2"/>'
    + '<path d="M3 46l17-24 17 24-4 5-13-18L9 51Zm61 0l17-24 17 24-4 5-13-18-11 18Z" fill="' + ROOF + '" stroke="' + INK + '" stroke-width="2"/>'
    + '<path d="M42 88V70q10-13 21 0v18Z" fill="#6e543d" stroke="' + INK + '" stroke-width="2"/>'
    + '<path d="M51 66v22M42 77h21" stroke="#d2ad77" stroke-width="1.5"/>'
    + '<path d="M15 59h9v14h-9Zm66 0h-9v14h9ZM46 41h11v15H46Z" fill="#776a55" stroke="' + INK + '" stroke-width="1.5"/>'
    + stoneLines + flag(51,2,side) + flag(19,21,side) + flag(81,21,side);
}
function village(side: Side) {
  return shadow + house(4,23,.87) + house(46,16,.78) + house(24,36,.87)
    + '<path d="M7 77v8m9-6v7m8-5v7m-18-7 18 3M71 81v8m9-9v8m-9-4 9-1" fill="none" stroke="#886b4a" stroke-width="2"/>'
    + '<path d="M79 45V29" stroke="' + INK + '" stroke-width="1.6"/>'
    + '<path data-team-accent="village" d="M79 29l11 3-11 5Z" fill="' + team(side) + '"/>'
    + '<path d="M4 89q32-5 58 0" fill="none" stroke="#a9966f" stroke-width="2"/>';
}
function barracks(side: Side) {
  return shadow
    + '<path d="M6 71l45-13 43 13-2 19-41 4-44-5Z" fill="#b7a580" stroke="' + INK + '" stroke-width="2"/>'
    + '<path d="M19 40h65v43l-34 5-31-4Z" fill="' + STONE + '" stroke="' + INK + '" stroke-width="2"/>'
    + '<path d="M13 40L49 13l41 27-7 8L48 25 20 47Z" fill="' + ROOF + '" stroke="' + INK + '" stroke-width="2.5"/>'
    + '<path d="M35 84V57q14-13 29 0v28Z" fill="#74563c" stroke="' + INK + '" stroke-width="2"/>'
    + '<path d="M36 63h27M38 71h25m-14-16v29" stroke="#d0af7f" stroke-width="2"/>'
    + '<path d="M6 62v27m7-34v34m75-32v31m6-23v24M4 64l14-4m67-2 13 6" fill="none" stroke="#70573d" stroke-width="3"/>'
    + '<path d="M18 53l14-19m-14 2 14 17" fill="none" stroke="' + INK + '" stroke-width="2"/>'
    + stoneLines + flag(49,2,side)
    + '<path data-team-accent="standard" d="M75 51h9v18l-5 4-4-4Z" fill="' + team(side) + '"/>';
}
function tower(side: Side) {
  return shadow
    + '<path d="M27 28h47l-4 57-21 5-21-6Z" fill="' + STONE + '" stroke="' + INK + '" stroke-width="2.6"/>'
    + '<path d="M52 31h22l-4 53-18 5Z" fill="' + SHADE + '" opacity=".7"/>'
    + '<path d="M22 28v-8h9v8h13v-8h10v8h13v-8h11v13H22Z" fill="' + STONE + '" stroke="' + INK + '" stroke-width="2"/>'
    + '<path d="M21 20L49 3l31 17" fill="none" stroke="' + INK + '" stroke-width="3"/>'
    + '<path d="M30 48h9v17h-9Zm29 0h9v17h-9Z" fill="#7d705b" stroke="' + INK + '" stroke-width="1.7"/>'
    + '<path d="M43 87V74q7-9 14 0v13Z" fill="#75533b" stroke="' + INK + '" stroke-width="2"/>'
    + '<path d="M31 73h13m16-8h7" stroke="#82745c" stroke-width="1.4"/>'
    + flag(49,0,side);
}
function fence(side: Side) {
  const stakes = Array.from({ length: 8 }, (_, i) => {
    const y = 6 + i * 11;
    return '<path d="M35 ' + (y+9) + 'v-7l15-7 15 7v7Z" fill="' + (i%2 ? '#b48a59' : '#c49c67') + '" stroke="' + INK + '" stroke-width="1.6"/>';
  }).join('');
  return '<path d="M37 6h28v92H37Z" fill="#957448" stroke="' + INK + '" stroke-width="2"/>'
    + stakes
    + '<path d="M34 28h34m-34 38h34" stroke="' + INK + '" stroke-width="4"/>'
    + '<path data-team-accent="bindings" d="M37 27h28v5H37Zm0 40h28v5H37Z" fill="' + team(side) + '" opacity=".8"/>';
}
function glyph(type: UnitType): string {
  const stroke = 'fill="none" stroke="' + INK + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"';
  switch (type) {
    case 'soldier': return '<path d="M32 22l36 36M68 22L32 58" ' + stroke + '/><path d="M30 19l11 0-8 11m37-11H59l8 11" ' + stroke + '/>';
    case 'militia': return '<path d="M50 16L71 23v21Q63 59 50 65 37 59 29 44V23Z" ' + stroke + '/><path d="M38 36l23 18m0-18L38 54" ' + stroke + '/>';
    case 'archer': return '<path d="M37 15Q64 39 37 65M34 15V65M35 40h37l-9-7m9 7-9 7" ' + stroke + '/>';
    case 'knight': return '<path d="M27 64l10-19-5-13 17-18 11 10 12-3 3 13-11 7 4 23ZM34 64h41M48 26h3" ' + stroke + '/>';
    case 'scout': return '<path d="M19 41Q50 9 81 41Q50 72 19 41Z" ' + stroke + '/><circle cx="50" cy="41" r="10" fill="' + INK + '"/><circle cx="53" cy="38" r="3" fill="' + PARCHMENT + '"/>';
    case 'royal_guard': return '<path d="M25 26l13 9 12-20 13 20 13-9-6 34H31Z" ' + stroke + '/><path d="M34 67h32M50 35v14" ' + stroke + '/>';
    case 'cannon': return '<path d="M21 30l47-11 8 14-43 14-12-5ZM26 47L20 60h60" ' + stroke + '/><circle cx="41" cy="57" r="12" ' + stroke + '/><circle cx="41" cy="57" r="3" fill="' + INK + '"/>';
  }
}
function counter(type: UnitType, side: Side) {
  const c = team(side);
  return '<rect x="3" y="7" width="94" height="76" rx="5" fill="#695843" opacity=".22"/>'
    + '<rect x="3" y="3" width="94" height="76" rx="4" fill="' + (side === 'blue' ? '#e7e9db' : '#f0ded0') + '" stroke="' + c + '" stroke-width="6"/>'
    + '<rect x="10" y="10" width="80" height="62" fill="none" stroke="#65513b" stroke-width="1.5"/>'
    + '<g transform="translate(0 -4)">' + glyph(type) + '</g>'
    + '<path data-team-accent="counter" d="M8 79h84v9H8Z" fill="' + c + '"/>'
    + '<path d="M25 82h10m13 0h10m13 0h10" stroke="' + cloth(side) + '" stroke-width="2.5"/>';
}
export function atlasEntityArt(type: AtlasEntity, side: Side): string {
  const building = ((): string => {
    switch (type) {
      case 'castle': return castle(side);
      case 'village': return village(side);
      case 'barracks': return barracks(side);
      case 'tower': return tower(side);
      case 'fence': return fence(side);
      default: return counter(type, side);
    }
  })();
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-entity="' + type + '" data-team="' + side + '" data-art="tactical-atlas">'
    + '<g stroke-linejoin="round" stroke-linecap="round">' + building + '</g></svg>';
}
