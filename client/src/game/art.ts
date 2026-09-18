import type { BuildingType, Side } from '@arena-kingdom/shared';
import { UNIT_SHOP_ASSETS, type ShopUnitType } from './unitShopAssets';

/**
 * Illustrated vector art for menus, the HUD and the home page. Each function returns a standalone
 * SVG (viewBox only) for inline use in the DOM. The battlefield itself draws map symbols (symbols.ts).
 */

const INK = '#1f2937';
const TEAM: Record<Side, { main: string; dark: string; light: string }> = {
  blue: { main: '#3b82f6', dark: '#1d4ed8', light: '#93c5fd' },
  red: { main: '#ef4444', dark: '#b91c1c', light: '#fca5a5' }
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


/**
 * Recruitment card artwork from the generated unit-card image.
 * The source is kept as a transparent raster asset for fidelity; Red adapts the same artwork with CSS.
 */
export function unitShopArt(type: ShopUnitType, side: Side) {
  return `<img class="unit-shop-image unit-shop-image-${side}" src="${UNIT_SHOP_ASSETS[type]}" alt="" aria-hidden="true" draggable="false" />`;
}

export function fallbackIcon(side: Side) {
  const t = TEAM[side];
  return svg(
    '0 0 64 64',
    `<path d="M32 4 L54 12 V30 C54 44 46 54 32 60 C18 54 10 44 10 30 V12 Z" fill="${t.main}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M32 15 V43 M22 29 H42" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
    <path d="M8 33 L17 24 M8 33 L19 36 M56 33 L47 24" fill="none" stroke="${t.dark}" stroke-width="3.2" stroke-linecap="round"/>`
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

/** Build-menu icon: the palisade seen side-on. */
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

/**
 * The battle ground is a single illustrated texture rather than a collection
 * of coloured rectangles. It keeps the engine's 1920 x 1080 coordinates, so
 * the richer landscape never changes movement, placement, or hit-testing.
 */
export function arenaMapArt() {
  const island =
    'M700 142 C768 118 858 130 930 120 C1018 108 1100 121 1208 145 C1288 164 1342 224 1348 310 L1348 755 C1342 846 1280 924 1194 947 C1104 972 1014 954 960 965 C893 956 792 976 706 946 C619 915 568 844 570 754 L570 322 C573 237 619 169 700 142 Z';
  const beach =
    'M718 170 C790 151 866 160 936 149 C1012 139 1100 153 1192 174 C1254 190 1306 242 1313 319 L1313 748 C1308 822 1260 886 1180 914 C1098 940 1016 922 960 935 C885 926 804 941 722 913 C649 887 607 821 605 746 L605 330 C608 259 650 193 718 170 Z';
  const grass =
    'M737 204 C802 184 872 193 940 181 C1016 173 1094 187 1176 205 C1234 219 1274 264 1278 332 L1278 740 C1272 798 1233 851 1160 877 C1088 902 1015 887 960 899 C892 890 816 904 744 877 C683 854 644 800 640 737 L640 341 C643 281 681 227 737 204 Z';
  return svg(
    '0 0 1920 1080',
    `<defs>
      <linearGradient id="ak-water" x1="0" y1="0" x2="0.82" y2="1">
        <stop offset="0" stop-color="#0b63b4"/><stop offset="0.48" stop-color="#117fd0"/><stop offset="1" stop-color="#07529d"/>
      </linearGradient>
      <radialGradient id="ak-water-light" cx="50%" cy="42%" r="72%">
        <stop offset="0" stop-color="#72cdf2" stop-opacity=".72"/><stop offset=".57" stop-color="#2d9de2" stop-opacity=".18"/><stop offset="1" stop-color="#063f86" stop-opacity=".18"/>
      </radialGradient>
      <linearGradient id="ak-sand" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f7d693"/><stop offset="1" stop-color="#c99552"/></linearGradient>
      <linearGradient id="ak-cliff" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#496c59"/><stop offset=".42" stop-color="#315445"/><stop offset="1" stop-color="#1e3834"/></linearGradient>
      <linearGradient id="ak-grass" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#6fcf79"/><stop offset=".44" stop-color="#38a962"/><stop offset="1" stop-color="#1f824d"/></linearGradient>
      <linearGradient id="ak-road" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#d5b778"/><stop offset=".5" stop-color="#f4dc9e"/><stop offset="1" stop-color="#b78e55"/></linearGradient>
      <linearGradient id="ak-blue-terrace" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#6ec8ee" stop-opacity=".7"/><stop offset="1" stop-color="#2071b1" stop-opacity=".12"/></linearGradient>
      <linearGradient id="ak-red-terrace" x1="0" y1="1" x2="0" y2="0"><stop stop-color="#e46d5b" stop-opacity=".62"/><stop offset="1" stop-color="#b8423f" stop-opacity=".08"/></linearGradient>
      <pattern id="ak-grass-speckle" width="54" height="48" patternUnits="userSpaceOnUse">
        <path d="M4 13l3-8 2 8m20 20l3-9 2 9m13-21l2-6 2 6M12 41l2-5 2 5" fill="none" stroke="#b9e889" stroke-width="1.5" stroke-linecap="round" opacity=".42"/>
        <circle cx="35" cy="8" r="1.4" fill="#1e844d" opacity=".58"/><circle cx="49" cy="37" r="1.2" fill="#d0ef9a" opacity=".35"/>
      </pattern>
      <pattern id="ak-sand-lines" width="44" height="32" patternUnits="userSpaceOnUse">
        <path d="M4 11c8-5 16-5 24 0M16 25c6-3 12-3 19 0" fill="none" stroke="#fff0bb" stroke-width="2" opacity=".35"/>
      </pattern>
      <filter id="ak-shadow" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="10"/></filter>
      <clipPath id="ak-land"><path d="${grass}"/></clipPath>
      <g id="ak-tree">
        <ellipse cx="0" cy="13" rx="21" ry="7" fill="#123f38" opacity=".35"/>
        <path d="M-3 14V-11" stroke="#704522" stroke-width="7" stroke-linecap="round"/>
        <path d="M-20 1C-22-17-10-29 1-24C7-37 27-24 21-7C31 6 16 18 3 12C-7 21-25 14-20 1Z" fill="#24754e" stroke="#175640" stroke-width="3" stroke-linejoin="round"/>
        <path d="M-13-3C-8-13-1-17 8-17M-6 7C4 0 11 1 18-4" fill="none" stroke="#72bd66" stroke-width="3" stroke-linecap="round" opacity=".8"/>
      </g>
      <g id="ak-rock">
        <ellipse cx="0" cy="9" rx="18" ry="5" fill="#153e3d" opacity=".28"/>
        <path d="M-17 7L-10-11 6-17 19-5 13 10-9 13Z" fill="#809587" stroke="#49675f" stroke-width="3" stroke-linejoin="round"/>
        <path d="M-8-9L5-13 12-5M-11 5L3 7" fill="none" stroke="#b9cab2" stroke-width="2.5" stroke-linecap="round" opacity=".75"/>
      </g>
      <g id="ak-flower">
        <circle r="4" fill="#ffe887"/><circle cx="-5" cy="0" r="4" fill="#f8a5be"/><circle cx="5" cy="0" r="4" fill="#f8a5be"/><circle cx="0" cy="-5" r="4" fill="#f8a5be"/><circle cx="0" cy="5" r="4" fill="#f8a5be"/>
      </g>
    </defs>

    <rect width="1920" height="1080" fill="url(#ak-water)"/>
    <rect width="1920" height="1080" fill="url(#ak-water-light)"/>
    <g fill="none" stroke="#a7e8f8" stroke-linecap="round" opacity=".48">
      <path d="M82 184c48-32 101-32 151 0s104 30 154-1M45 215c65-23 128-20 188 8s126 25 179-4" stroke-width="6"/>
      <path d="M1480 250c52-28 108-26 159 2s105 26 158-2M1518 286c39-16 83-14 125 7s92 20 139-4" stroke-width="5"/>
      <path d="M105 809c62-25 119-22 177 7s111 24 158-3M1450 874c54-30 111-29 166 0s108 27 169-3" stroke-width="6"/>
      <path d="M352 500c28-14 60-13 88 3s56 16 82-1M1395 546c28-15 61-14 90 4s58 17 85-1" stroke-width="4"/>
    </g>

    <path d="${island}" fill="#082e36" opacity=".38" filter="url(#ak-shadow)" transform="translate(0 18)"/>
    <path d="${island}" fill="url(#ak-cliff)" stroke="#244b43" stroke-width="13" stroke-linejoin="round"/>
    <path d="${beach}" fill="url(#ak-sand)" stroke="#f8e0a3" stroke-width="6" stroke-linejoin="round"/>
    <path d="${beach}" fill="url(#ak-sand-lines)" opacity=".52"/>
    <path d="${grass}" fill="url(#ak-grass)" stroke="#176b46" stroke-width="8" stroke-linejoin="round"/>

    <g clip-path="url(#ak-land)">
      <rect x="620" y="170" width="680" height="750" fill="url(#ak-grass-speckle)" opacity=".72"/>
      <path d="M640 376C782 333 847 363 960 343c115-20 205-4 318 34v83c-117-28-202-39-316-20c-116 19-203 0-322 37Z" fill="url(#ak-blue-terrace)"/>
      <path d="M640 707c126 35 210 36 323 15c116-23 205-4 315 33v95c-124-25-208-40-316-18c-116 22-202 17-322-19Z" fill="url(#ak-red-terrace)"/>

      <path d="M947 211c-72 108-48 182-2 256c36 59 35 109-2 160c-50 69-63 145-5 255" fill="none" stroke="#705b3d" stroke-width="126" stroke-linecap="round" opacity=".24"/>
      <path d="M947 211c-72 108-48 182-2 256c36 59 35 109-2 160c-50 69-63 145-5 255" fill="none" stroke="url(#ak-road)" stroke-width="78" stroke-linecap="round" opacity=".92"/>
      <path d="M947 211c-72 108-48 182-2 256c36 59 35 109-2 160c-50 69-63 145-5 255" fill="none" stroke="#fff1bd" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 18" opacity=".5"/>

      <path d="M675 470c88-26 160-18 231 15M1012 475c77-36 164-33 250 4M662 617c75 24 141 18 220-12M1027 605c78 30 152 30 238 4" fill="none" stroke="#8bd46e" stroke-width="22" stroke-linecap="round" opacity=".5"/>
      <path d="M683 490c76-20 135-14 199 14M1048 500c61-23 128-20 190 6M680 592c67 17 126 13 193-11M1065 584c63 24 118 24 176 2" fill="none" stroke="#1d834c" stroke-width="10" stroke-linecap="round" opacity=".42"/>

      <circle cx="960" cy="545" r="73" fill="#305f57" opacity=".28"/>
      <circle cx="960" cy="545" r="61" fill="#9f8458" stroke="#6e5c42" stroke-width="7"/>
      <circle cx="960" cy="545" r="47" fill="#d8c48d" stroke="#f7e3aa" stroke-width="4"/>
      <path d="M960 505v80M920 545h80M932 517l56 56M988 517l-56 56" stroke="#b98d4f" stroke-width="5" stroke-linecap="round" opacity=".9"/>
      <circle cx="960" cy="545" r="14" fill="#47a9b2" stroke="#276978" stroke-width="4"/>

      <g opacity=".95">
        <use href="#ak-tree" transform="translate(688 261) scale(1.1)"/><use href="#ak-tree" transform="translate(735 229) scale(.78)"/>
        <use href="#ak-tree" transform="translate(1228 263) scale(1.04)"/><use href="#ak-tree" transform="translate(1183 225) scale(.72)"/>
        <use href="#ak-tree" transform="translate(690 818) scale(1.05)"/><use href="#ak-tree" transform="translate(738 854) scale(.72)"/>
        <use href="#ak-tree" transform="translate(1230 816) scale(1.12)"/><use href="#ak-tree" transform="translate(1185 851) scale(.7)"/>
        <use href="#ak-rock" transform="translate(704 408) scale(.9)"/><use href="#ak-rock" transform="translate(1219 414) scale(.8)"/>
        <use href="#ak-rock" transform="translate(704 685) scale(.8)"/><use href="#ak-rock" transform="translate(1221 680) scale(.9)"/>
        <use href="#ak-flower" transform="translate(754 541) scale(1.2)"/><use href="#ak-flower" transform="translate(1170 548) scale(1)"/>
      </g>

      <g transform="translate(960 285)">
        <path d="M-121 50h242l-16 22H-105Z" fill="#53736c" opacity=".6"/>
        <path d="M-112 40h224l-15 18H-97Z" fill="#7d9b86" stroke="#45685c" stroke-width="4"/>
        <path d="M-92 12h184v29H-92Z" fill="#a8c3b2" opacity=".55"/>
      </g>
      <g transform="translate(960 805)">
        <path d="M-121-50h242l-16-22H-105Z" fill="#4f6658" opacity=".6"/>
        <path d="M-112-40h224l-15-18H-97Z" fill="#809b84" stroke="#456354" stroke-width="4"/>
        <path d="M-92-12h184v-29H-92Z" fill="#adc1ae" opacity=".48"/>
      </g>
    </g>

    <g fill="none" stroke="#f8f1c8" stroke-linecap="round" opacity=".8">
      <path d="M632 301c-22 19-26 50-14 75M1288 300c24 22 28 53 14 79M630 708c-22 24-25 52-11 79M1288 706c22 21 25 54 11 82" stroke-width="8"/>
      <path d="M652 227c35-17 75-22 111-14M1156 209c42-7 77 0 111 19M653 868c35 18 71 23 113 15M1151 882c39 7 78 0 115-18" stroke-width="5"/>
    </g>
    <g opacity=".76" fill="#d2e8c0">
      <circle cx="731" cy="165" r="5"/><circle cx="780" cy="152" r="3"/><circle cx="1210" cy="163" r="4"/><circle cx="1280" cy="217" r="4"/>
      <circle cx="654" cy="840" r="4"/><circle cx="732" cy="920" r="3"/><circle cx="1206" cy="923" r="5"/><circle cx="1280" cy="850" r="3"/>
    </g>`
  );
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
