import type { BuildingType, Side, UnitType } from '@arena-kingdom/shared';
import type { SymbolSize } from './symbols';

export type FantasyEntity = UnitType | BuildingType;
/** World art sizes; the anchor always describes the footprint, never the helmet/roof. */
export const FANTASY_SIZE: Record<FantasyEntity, SymbolSize> = {
  soldier: { width: 32, height: 41, anchorY: .86 },
  militia: { width: 31, height: 39, anchorY: .86 },
  archer: { width: 36, height: 42, anchorY: .86 },
  scout: { width: 33, height: 40, anchorY: .86 },
  knight: { width: 47, height: 48, anchorY: .84 },
  royal_guard: { width: 40, height: 47, anchorY: .86 },
  cannon: { width: 49, height: 41, anchorY: .77 },
  castle: { width: 112, height: 136, anchorY: .8 },
  village: { width: 65, height: 76, anchorY: .8 },
  barracks: { width: 73, height: 82, anchorY: .8 },
  tower: { width: 52, height: 96, anchorY: .85 },
  fence: { width: 28, height: 140, anchorY: .5 }
};

const materials = `<defs>
  <linearGradient id="steel" x2="1" y2=".8"><stop stop-color="#f0e9cd"/><stop offset=".34" stop-color="#b5c3be"/><stop offset=".65" stop-color="#738793"/><stop offset="1" stop-color="#3b4a59"/></linearGradient>
  <linearGradient id="stone" x2=".8" y2="1"><stop stop-color="#d1cbb0"/><stop offset=".45" stop-color="#a5aa97"/><stop offset="1" stop-color="#697e79"/></linearGradient>
  <linearGradient id="wood" x2="1" y2=".4"><stop stop-color="#bb915b"/><stop offset=".55" stop-color="#90633c"/><stop offset="1" stop-color="#553d2c"/></linearGradient>
  <linearGradient id="slate" x2=".8" y2="1"><stop stop-color="#82959a"/><stop offset=".4" stop-color="#4b6778"/><stop offset="1" stop-color="#283d52"/></linearGradient>
  <linearGradient id="gold" x2="1" y2="1"><stop stop-color="#f4df9e"/><stop offset=".45" stop-color="#b49457"/><stop offset="1" stop-color="#79613e"/></linearGradient>
</defs>`;
const accent = (side: Side) => side === 'blue' ? '#459bd3' : '#cd5960';
const accentLight = (side: Side) => side === 'blue' ? '#a2d4e9' : '#efb1a2';
const ink = '#23333b';
const shadow = (y = 86, rx = 23) => `<ellipse cx="53" cy="${y + 2}" rx="${rx}" ry="5" fill="#112b2e" opacity=".28"/>`;
const boots = `<path d="M39 65l-4 18-7 3h15l6-18m5-3 3 18 13 3H55l-7-18" fill="#3c3b33" stroke="${ink}" stroke-width="2"/>`;
const head = `<path d="M36 24q1-18 15-18 14 0 16 18l-4 16H40Z" fill="url(#steel)" stroke="${ink}" stroke-width="2"/>
  <path d="M38 23l26-2-4 8H41Z" fill="#273a42"/><path d="M51 7v28" stroke="#d9dfd0" stroke-width="2"/>`;
const face = `<path d="M39 21q11-10 22 0v12q-9 13-20 0Z" fill="#c9a37c" stroke="${ink}" stroke-width="2"/><path d="M46 27h2m8-1h2" stroke="#344148" stroke-width="2"/>`;
const crest = (side: Side, x = 50, y = 48) => `<g data-team-accent="crest"><path d="M${x - 5} ${y - 5}h10v9l-5 4-5-4Z" fill="${accent(side)}"/><path d="M${x - 2} ${y}l2-3 2 3-2 3Z" fill="${accentLight(side)}"/></g>`;
const flag = (side: Side, x: number, y: number) => `<path d="M${x} ${y}v21" stroke="#bca66e" stroke-width="1.5"/>
  <g data-team-accent="flag"><path d="M${x + 1} ${y}q8-3 15 1l-3 5 3 5q-7-4-15-1Z" fill="${accent(side)}" stroke="${ink}" stroke-width=".8"/><path d="M${x + 5} ${y + 2}l3 3-3 3" fill="none" stroke="${accentLight(side)}"/></g>`;

function infantry(type: 'soldier' | 'royal_guard', side: Side) {
  const royal = type === 'royal_guard';
  return `${shadow()}${boots}
    <path d="M35 37q16-6 33 0l8 33H27Z" fill="#414d53" stroke="${ink}" stroke-width="2"/>
    <g data-team-accent="cloak"><path d="M37 36l-9 36 15-8 7-26Z" fill="${accent(side)}"/><path d="M38 39l-5 25 7-6" fill="none" stroke="${accentLight(side)}" opacity=".5"/></g>
    <path d="M36 38l16-6 15 6-4 22-12 8-14-9Z" fill="url(#${royal ? 'gold' : 'steel'})" stroke="${ink}" stroke-width="2"/>
    <path d="M38 39l12 5 13-5M51 45v19" fill="none" stroke="#e3debd" opacity=".7" stroke-width="1.7"/>
    <path d="M30 36l9-3 5 8-9 8-10-4m40-10 9 3 6 8-10 3-10-9" fill="url(#steel)" stroke="${ink}" stroke-width="2"/>
    ${head}${royal ? '<path d="M38 11l2-8 9 6 4-8 5 9 8-4-3 12" fill="url(#gold)" stroke="#7c6748" stroke-width="2"/>' : ''}
    <path d="M77 71l-3-48 5-12 5 11-3 49Z" fill="url(#steel)" stroke="${ink}" stroke-width="1.8"/><path d="M70 62h17" stroke="#bea572" stroke-width="3"/>
    <path d="M16 45l22-4 6 20q-6 13-15 17-13-6-15-20Z" fill="url(#${royal ? 'gold' : 'steel'})" stroke="${ink}" stroke-width="2.3"/>
    <path d="M17 47l20-4 4 15q-8 12-12 16-10-6-13-16Z" fill="#344b58"/>
    <g data-team-accent="shield"><path d="M21 50l13-3 2 12-7 10-7-9Z" fill="${accent(side)}"/><path d="M25 55l4-3 3 3-3 7Z" fill="${accentLight(side)}"/></g>${crest(side)}`;
}

function lightUnit(type: 'archer' | 'scout' | 'militia', side: Side) {
  const scout = type === 'scout', militia = type === 'militia';
  return `${shadow()}${boots}
    <g data-team-accent="scarf"><path d="M34 34l-12 33 18 8 17-8-1-30Z" fill="${accent(side)}"/></g>
    <path d="M37 36l23-3 11 33-22 5-17-9Z" fill="${militia ? '#a8956c' : '#667665'}" stroke="${ink}" stroke-width="2"/>
    <path d="M41 36l15 34M32 53l36-7" stroke="#bda172" stroke-width="3"/>
    <path d="M35 35L23 52l9 8 10-20m20-4 10 11 10 5-4 6-14-9-8-8" fill="#8f7957" stroke="${ink}" stroke-width="2"/>
    ${face}
    ${militia ? '<path d="M35 21q1-16 16-16 14 0 15 15l-6-4-20 3Z" fill="#71573b" stroke="#28383c" stroke-width="2"/>' : '<path d="M33 24Q32 2 51 2q18 3 17 23l-10-9-17 4-8 10Z" fill="#354b46" stroke="#23333b" stroke-width="2"/><path d="M37 18Q40 7 52 7" fill="none" stroke="#86957b" stroke-width="2"/>'}
    ${scout ? '<path d="M69 47l19-9 6 11-20 8Z" fill="url(#gold)" stroke="#23333b" stroke-width="2"/><ellipse cx="91" cy="44" rx="4" ry="6" fill="#98c4c0" stroke="#3b5658" stroke-width="2"/><path d="M22 31l-7 12 13 4" fill="#b49d6c" stroke="#23333b" stroke-width="2"/>' : militia ? '<path d="M76 78l-1-44" stroke="#624732" stroke-width="5"/><path d="M75 28l-12 5 3 15 10-7 12 3-1-14Z" fill="url(#steel)" stroke="#23333b" stroke-width="2"/>' : '<path d="M79 20Q106 48 78 78" fill="none" stroke="#c6a76c" stroke-width="4"/><path d="M79 20L78 78" stroke="#d2d7b7" stroke-width="1.4"/><path d="M59 48h37l-7-4m7 4-7 4" fill="none" stroke="#c4c9b3" stroke-width="2"/><path d="M23 30l-5-16m8 14-1-17m6 18 2-18" stroke="#d8c79d" stroke-width="2"/>'}
    ${crest(side, 51, 48)}`;
}

function knight(side: Side) {
  return `${shadow(84, 36)}
    <path d="M25 56l-5 24-8 4h12l9-22m18-4 8 23 11 3H58l-9-21m20-3 9 20 10 4H76L62 59" fill="#423e35" stroke="${ink}" stroke-width="2"/>
    <path d="M23 49q19-11 38-1l9-17 14-5 9 17-11 8-6-6-6 17q-21 10-45-1Z" fill="#a88c69" stroke="${ink}" stroke-width="2"/>
    <path d="M70 32l10-8 7 1-4 8 5 10-13-4Z" fill="#433e34"/><path d="M24 47Q7 42 9 65l12-7" fill="#433e34"/>
    <path d="M28 50l30-3 8 20-16 5-21-8Z" fill="url(#steel)" stroke="${ink}" stroke-width="2"/>
    <g data-team-accent="saddle"><path d="M34 52l23-1 6 18-13 5-18-9Z" fill="${accent(side)}"/><path d="M39 55l6 12 12 1" stroke="${accentLight(side)}" fill="none" stroke-width="2"/></g>
    <path d="M70 34l12-4 6 11-14 7Z" fill="url(#steel)" stroke="${ink}" stroke-width="1.5"/>
    <g transform="translate(7 -2) scale(.75)">${head}<path d="M37 38l24-4 13 27-18 6-24-7Z" fill="url(#steel)" stroke="${ink}" stroke-width="2"/><path d="M39 59l12 17 9-1-5-18" fill="#3e4b50" stroke="${ink}" stroke-width="3"/>${crest(side, 51, 48)}</g>
    <path d="M58 42L91 7" stroke="#d3d5bd" stroke-width="2.7"/><path d="M87 8l9-6-2 11Z" fill="url(#steel)" stroke="${ink}"/>
    <path d="M25 23l16-2 1 16-9 7-9-8Z" fill="url(#steel)" stroke="${ink}" stroke-width="2"/>${crest(side, 33, 30)}`;
}

function cannon(side: Side) {
  const wheel = (x: number, y: number) => `<ellipse cx="${x}" cy="${y}" rx="11" ry="15" fill="#3a3b35" stroke="#d2b581" stroke-width="3"/><ellipse cx="${x}" cy="${y}" rx="7" ry="11" fill="url(#wood)"/><path d="M${x - 6} ${y}h12M${x} ${y - 10}v20m-5-17 10 14m-10 0 10-14" stroke="#c9ac72" stroke-width="1.4"/><circle cx="${x}" cy="${y}" r="3" fill="url(#steel)"/>`;
  return `${shadow(77, 36)}${wheel(65, 60)}
    <path d="M19 65l42-10 18 14-36 15-26-10Z" fill="url(#wood)" stroke="${ink}" stroke-width="2"/><path d="M23 64l40-8 6 5-40 9Z" fill="#cfaa76"/>
    <path d="M30 45l17-10 40-4 5 15-44 17-13-4Z" fill="url(#steel)" stroke="${ink}" stroke-width="2.5"/>
    <path d="M43 38l6 22M71 33l5 19" stroke="#b99e61" stroke-width="4"/>
    <ellipse cx="87" cy="39" rx="7" ry="9" fill="#273740" stroke="#a0acaa" stroke-width="3"/>
    <path d="M27 54l-9-16-4 3 7 16" fill="#8d6a43" stroke="${ink}" stroke-width="2"/>
    ${wheel(34, 70)}${crest(side, 52, 69)}`;
}

const masonry = `<path d="M22 54h11m-6 9h12m25-9h13m-9 9h13M40 46h12m4 10h12M17 71h14m35 0h15" stroke="#596e6d" stroke-width="1" opacity=".65"/>`;
const windowSlit = (x: number, y: number) => `<path d="M${x} ${y + 8}v-5q3-6 6 0v5Z" fill="#33474b"/><path d="M${x + 2} ${y + 2}v5" stroke="#e4c18a" stroke-width="1.5"/>`;
const roof = (x: number, y: number, w: number) => `<path d="M${x} ${y}l${w / 2} ${-w * .6} ${w / 2} ${w * .6}Z" fill="url(#slate)" stroke="${ink}" stroke-width="1.5"/><path d="M${x + 2} ${y - 2}l${w / 2 - 2} ${-w * .52}" stroke="#b4bbaa" stroke-width="1.5"/>`;
function castle(side: Side) {
  return `${shadow(80, 43)}<path d="M9 76l42-16 42 16-7 12H16Z" fill="url(#stone)" stroke="${ink}" stroke-width="1.5"/>
    <path d="M17 50h66v29l-32 8-34-10Z" fill="url(#stone)" stroke="${ink}" stroke-width="1.8"/>
    <path d="M39 28h26v47H39Z" fill="url(#stone)" stroke="${ink}" stroke-width="1.8"/><path d="M55 29h10v45H55" fill="#687f7e" opacity=".6"/>
    ${roof(34, 31, 36)}${flag(side, 52, 4)}
    <path d="M10 42h23v35l-11 5-12-5Zm59-1h23v36l-11 5-12-5Z" fill="url(#stone)" stroke="${ink}" stroke-width="1.8"/>
    <path d="M25 43h8v35l-8 3m59-38h8v35l-8 3" fill="#6c817d"/>
    ${roof(6, 43, 31)}${roof(65, 42, 31)}
    ${windowSlit(18, 52)}${windowSlit(77, 52)}${windowSlit(48, 38)}${masonry}
    <path d="M38 82V69q13-17 26 0v13Z" fill="#344648" stroke="#dccb9d" stroke-width="3"/><path d="M42 81V70q9-12 18 0v11Z" fill="url(#wood)"/><path d="M50 64v18m-7-8h15" stroke="#4b4839" stroke-width="1.5"/>
    <g data-team-accent="banners"><path d="M11 54h7v15l-4 4-3-4Zm73 0h7v15l-4 4-3-4Z" fill="${accent(side)}" stroke="#b3b59b" stroke-width="1"/></g>
    <path d="M40 84h22m-25 3h28" stroke="#d7cba6" stroke-width="2"/>`;
}

function house(x: number, y: number, w: number, side: Side) {
  return `<g transform="translate(${x} ${y})"><path d="M2 22h${w - 4}v24l${-w / 2} 5L2 46Z" fill="url(#stone)" stroke="${ink}" stroke-width="1.5"/>
    <path d="M${w * .64} 23H${w - 2}v23l${-w * .35} 5Z" fill="#728276"/>
    <path d="M0 24L${w * .43} 3 ${w} 21l-4 7-14-3-8-8-7 11Z" fill="url(#wood)" stroke="${ink}" stroke-width="1.8"/>
    <path d="M3 23L${w * .43} 6l${w * .4} 15M8 19l14 3" fill="none" stroke="#d0b58c" stroke-width="1"/>
    <path d="M${w * .4} 50V35q5-8 10 0v11" fill="#493f32" stroke="#b2ab83" stroke-width="2"/>
    <path d="M6 31h7v7H6Z" fill="#e3bc7d" stroke="#59625b"/>
    <g data-team-accent="cloth"><path d="M6 40h7v7l-3 2-4-2Z" fill="${accent(side)}"/></g></g>`;
}
function village(side: Side) {
  return `${shadow(80, 39)}${house(9, 19, 38, side)}${house(54, 14, 35, side)}${house(29, 35, 43, side)}
    <path d="M21 82l12-4m40-2 12 3" stroke="#b7b295" stroke-width="2"/><path d="M75 24V9h6v18" fill="url(#stone)" stroke="${ink}"/>
    <path d="M8 73h14v7H8Z" fill="url(#wood)" stroke="#534c36"/><path d="M9 74h12" stroke="#c2aa74"/>`;
}
function barracks(side: Side) {
  return `${shadow(80, 40)}<path d="M9 76l40-15 41 13-5 12-37 5-35-10Z" fill="#7b8871" stroke="#4b6058"/>
    <path d="M14 38h68v39l-33 7-35-8Z" fill="url(#stone)" stroke="${ink}" stroke-width="1.8"/>
    <path d="M65 40h17v37l-17 4Z" fill="#6d807b"/>
    <path d="M8 40L44 12l44 25-8 9-38-17-26 17Z" fill="url(#slate)" stroke="${ink}" stroke-width="2"/>
    <path d="M16 37l28-21 34 19M29 27l38 19" stroke="#9aaba1" stroke-width="1.2" fill="none"/>
    <path d="M31 79V54q15-18 29 0v24Z" fill="#263b3c" stroke="#d2c5a0" stroke-width="3"/>
    <path d="M34 62h23m-23 8h23m-17-20v26m10-26v26" stroke="#866a46" stroke-width="2"/>
    ${flag(side, 44, 2)}${masonry}${windowSlit(19, 48)}${windowSlit(69, 48)}
    <g data-team-accent="banners"><path d="M17 62h9v17l-4-3-5 3Zm48-1h9v17l-4-3-5 3Z" fill="${accent(side)}"/></g>
    <path d="M8 87l16-5m51 3 17-3" stroke="#b3b59b" stroke-width="2"/><path d="M11 76l11-8m-11 0 11 8" stroke="#c5baa0" stroke-width="2"/>`;
}
function tower(side: Side) {
  return `${shadow(85, 30)}<path d="M19 83l33-9 29 9-7 8H27Z" fill="url(#stone)" stroke="${ink}"/>
    <path d="M29 34h44l-4 50-20 5-21-6Z" fill="url(#stone)" stroke="${ink}" stroke-width="2"/><path d="M56 36h16l-3 48-13 3Z" fill="#718681"/>
    <path d="M24 29h54v10H24Z" fill="url(#stone)" stroke="${ink}" stroke-width="2"/>
    <path d="M25 29v-7h8v7h11v-7h9v7h11v-7h12v7" fill="url(#stone)" stroke="${ink}" stroke-width="2"/>
    ${roof(25, 23, 53)}${flag(side, 50, 1)}${windowSlit(43, 44)}${windowSlit(43, 64)}
    <path d="M30 58h13m16 7h10m-37 8h13" stroke="#607571" stroke-width="1.4"/>
    <g data-team-accent="banner"><path d="M60 44h9v24l-5 5-4-5Z" fill="${accent(side)}"/><path d="M62 48h5" stroke="${accentLight(side)}"/></g>`;
}
function fence(side: Side) {
  return `<path d="M35 5h38v91H35Z" fill="#152e2c" opacity=".25"/>
    <path d="M43 5h19v90H43Z" fill="url(#wood)" stroke="#423e2f" stroke-width="2"/>
    ${Array.from({ length: 12 }, (_, i) => `<path d="M32 ${6 + i * 7.4}l10-3h19l8 3-7 4H41Z" fill="url(#wood)" stroke="#54472e" stroke-width="1"/><path d="M34 ${6 + i * 7.4}h21" stroke="#d0b07b" stroke-width="1"/>`).join('')}
    <path d="M40 3h24v5H40Zm0 89h24v6H40Z" fill="url(#steel)" stroke="${ink}"/>
    <g data-team-accent="bindings"><path d="M40 25h24v3H40Zm0 47h24v3H40Zm0 25h24v3H40Z" fill="${accent(side)}"/></g>`;
}

export function fantasyEntityArt(type: FantasyEntity, side: Side): string {
  let body: string;
  switch (type) {
    case 'soldier': case 'royal_guard': body = infantry(type, side); break;
    case 'archer': case 'scout': case 'militia': body = lightUnit(type, side); break;
    case 'knight': body = knight(side); break;
    case 'cannon': body = cannon(side); break;
    case 'castle': body = castle(side); break;
    case 'village': body = village(side); break;
    case 'barracks': body = barracks(side); break;
    case 'tower': body = tower(side); break;
    case 'fence': body = fence(side); break;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-entity="${type}" data-team="${side}">${materials}<g stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
}
