import { GAME_RULES, coastline, coastSamples } from '@arena-kingdom/shared';
import { blockedRidgesArt, type ArtQuality } from './terrainArt';
import type { MapViewSize } from './mapArt';

// Original illustrated cartography. Entities and combat overlays are separate.
// ASCII-only SVG for the existing Phaser btoa loader.
const fmt = (n: number) => n.toFixed(1);
const hash = (n: number) => {
  const v = Math.sin(n * 127.1 + 19.73) * 43758.5453;
  return v - Math.floor(v);
};
const tree = (x: number, y: number, size: number, pine: boolean) => {
  const shape = pine
    ? '<path d="M0 -19L-9 -5h5L-12 6h7L-14 15Q0 19 14 15L5 6h7L4-5h5Z" fill="#687e5a"/><path d="M0 -18L-8 -4l9 -2L-10 12L1 9" fill="#adc095" opacity=".65"/>'
    : '<path d="M0 4q-15-7-9-18 5-11 15-7 11-9 17 3 11 10-1 21-10 9-22 1Z" fill="#81946b"/><path d="M0 -11q-8-11-14 1m25-3q11-7 14 5M-5 4q12 4 19-3" fill="none" stroke="#a6b18a"/>';
  return '<g transform="translate(' + fmt(x) + ' ' + fmt(y) + ') scale(' + fmt(size) + ')" stroke="#3d4936" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5v18" stroke="#63513a" stroke-width="3"/>' + shape + '</g>';
};
function grove(cx: number, cy: number, count: number, seed: number) {
  return Array.from({ length: count }, (_, i) => {
    const dx = (hash(seed + i * 5) - .5) * 120;
    const dy = (hash(seed + i * 5 + 1) - .5) * 75;
    return { x: cx + dx, y: cy + dy, size: .57 + hash(seed + i * 5 + 2) * .3, pine: (seed + i) % 3 === 0 };
  }).sort((a, b) => a.y - b.y).map(t => tree(t.x, t.y, t.size, t.pine)).join('');
}
function compass(cx: number, cy: number) {
  const arms = Array.from({ length: 8 }, (_, i) => {
    const a = i * 45;
    const len = i % 2 ? 30 : 48;
    return '<g transform="rotate(' + a + ')"><path d="M0 0L-6 -7L0 -' + len + 'Z" fill="#e4c78d" stroke="#493b29"/><path d="M0 0L6 -7L0 -' + len + 'Z" fill="#544432" stroke="#493b29"/></g>';
  }).join('');
  return '<g data-cartography="compass" transform="translate(' + cx + ' ' + cy + ')" opacity=".83"><circle r="36" fill="#e7d8b4" opacity=".48"/><circle r="41" fill="none" stroke="#644c32" stroke-width="1.2"/>' + arms + '<circle r="5" fill="#ad7842" stroke="#473626" stroke-width="2"/><text y="-58" text-anchor="middle" font-size="21" font-family="Georgia, serif" fill="#453625">N</text></g>';
}
function seaHatching(samples: ReturnType<typeof coastSamples>) {
  return [10, 20, 33, 48, 67].map((offset, i) => {
    const d = samples.filter((_, j) => j % 2 === 0).map(p => fmt(p.x + p.nx * (p.margin + offset)) + ' ' + fmt(p.y + p.ny * (p.margin + offset))).join('L');
    return '<path d="M' + d + 'Z" fill="none" stroke="#34596a" stroke-width="' + (i === 0 ? 3 : 1.5) + '" opacity="' + (.55 - i * .07) + '"/>';
  }).join('');
}
function ornaments(x: number, y: number, width: number, height: number) {
  const cx = x + width / 2, right = x + width, bottom = y + height;
  const corner = (px: number, py: number, sx: number, sy: number) =>
    '<g transform="translate(' + px + ' ' + py + ') scale(' + sx + ' ' + sy + ')" fill="none" stroke="#6a4b2d" stroke-width="2.5"><path d="M0 84Q3 14 84 0M0 57Q10 10 57 0M11 45Q31 41 32 19Q53 21 51 8M8 70q18-8 20-24"/><circle cx="15" cy="15" r="6" fill="#b79763"/></g>';
  return '<g data-cartography="frame" pointer-events="none">'
    + '<rect x="' + (x+9) + '" y="' + (y+9) + '" width="' + (width-18) + '" height="' + (height-18) + '" rx="5" fill="none" stroke="#483826" stroke-width="9"/>'
    + '<rect x="' + (x+18) + '" y="' + (y+18) + '" width="' + (width-36) + '" height="' + (height-36) + '" fill="none" stroke="#bf9859" stroke-width="4"/>'
    + '<rect x="' + (x+27) + '" y="' + (y+27) + '" width="' + (width-54) + '" height="' + (height-54) + '" fill="none" stroke="#513c27" stroke-width="1.8"/>'
    + corner(x+17,y+17,1,1) + corner(right-17,y+17,-1,1)
    + corner(x+17,bottom-17,1,-1) + corner(right-17,bottom-17,-1,-1)
    + '<g font-family="Georgia,serif" text-anchor="middle" font-size="12" letter-spacing="3" fill="#6e563a"><text x="' + cx + '" y="' + (bottom-24) + '">ARENA KINGDOM  -  TACTICAL ATLAS</text></g>'
    + '</g>';
}
export function arenaMapArtAtlas(view: MapViewSize = GAME_RULES.map, quality: ArtQuality = 'medium', nature = true): string {
  const { width: W, height: H, blueLand, redLand } = GAME_RULES.map;
  const x = (W - view.width) / 2, y = (H - view.height) / 2;
  const full = 'x="' + x + '" y="' + y + '" width="' + view.width + '" height="' + view.height + '"';
  const shore = 'M' + coastline(480).map(p => fmt(p.x) + ' ' + fmt(p.y)).join('L') + 'Z';
  const coastal = seaHatching(coastSamples(240));
  const amount = !nature ? .45 : quality === 'low' ? .55 : quality === 'medium' ? .8 : 1;
  const groups: ReadonlyArray<[number, number, number]> = [
    [335, 250, 8], [515, 242, 7], [345, 390, 6], [610, 352, 6],
    [390, 700, 9], [640, 748, 10], [490, 815, 5], [710, 610, 5]
  ];
  const woods = groups.map(([cx, cy, count], i) => {
    const n = Math.max(2, Math.round(count * amount));
    return grove(cx, cy, n, i * 93 + 11) + grove(W-cx, cy, n, i * 93 + 11);
  }).join('');
  const stippling = Array.from({ length: quality === 'low' ? 115 : quality === 'medium' ? 200 : 300 }, (_, i) => {
    const px = 175 + hash(i*3+50) * (W-350), py = 151 + hash(i*3+51) * (H-302);
    const size = 1.1 + hash(i*3+52) * 2.5;
    return '<path d="M' + fmt(px) + ' ' + fmt(py) + 'l' + fmt(size) + ' -1m-5 6l3 1" fill="none" stroke="#896f4c" opacity=".19" stroke-width="1"/>';
  }).join('');
  const borderX = (blueLand.maxX + redLand.minX) / 2;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + x + ' ' + y + ' ' + view.width + ' ' + view.height + '" data-map-style="atlas">'
    + '<defs>'
    + '<path id="atlas-coast" d="' + shore + '"/>'
    + '<clipPath id="atlas-land"><use href="#atlas-coast"/></clipPath>'
    + '<pattern id="atlas-water" width="92" height="58" patternUnits="userSpaceOnUse"><path d="M6 16q13-6 29 0m19 21q14-6 32 0M2 50q18-6 39 0" fill="none" stroke="#2b5667" stroke-width="1.5" opacity=".47"/></pattern>'
    + '<pattern id="atlas-grain" width="46" height="39" patternUnits="userSpaceOnUse"><circle cx="10" cy="8" r="1" fill="#6c5333" opacity=".12"/><circle cx="31" cy="24" r=".8" fill="#6c5333" opacity=".14"/><path d="M4 31l5-2m20-17 3-1" stroke="#856946" opacity=".12"/></pattern>'
    + '<linearGradient id="atlas-sea" x2=".2" y2="1"><stop stop-color="#a1bbbf"/><stop offset="1" stop-color="#6993a0"/></linearGradient>'
    + '<linearGradient id="atlas-paper" x2=".8" y2="1"><stop stop-color="#f4e7c4"/><stop offset=".55" stop-color="#f0ddb3"/><stop offset="1" stop-color="#dcc79f"/></linearGradient>'
    + '<radialGradient id="atlas-vignette"><stop offset=".6" stop-color="#382a1c" stop-opacity="0"/><stop offset="1" stop-color="#382a1c" stop-opacity=".16"/></radialGradient>'
    + '</defs>'
    + '<rect ' + full + ' fill="#d4bb88"/>'
    + '<rect ' + full + ' fill="url(#atlas-sea)"/><rect ' + full + ' fill="url(#atlas-water)"/>'
    + coastal
    + '<use href="#atlas-coast" transform="translate(2 7)" fill="#374b4a" opacity=".28"/>'
    + '<use href="#atlas-coast" fill="url(#atlas-paper)" stroke="#385965" stroke-width="6"/>'
    + '<g clip-path="url(#atlas-land)">'
    + '<use href="#atlas-coast" fill="none" stroke="#b99c6c" stroke-width="24" opacity=".45"/>'
    + '<rect ' + full + ' fill="url(#atlas-grain)"/>'
    + '<rect x="0" y="0" width="' + blueLand.maxX + '" height="' + H + '" fill="#cad7a1" opacity=".19"/>'
    + '<rect x="' + redLand.minX + '" y="0" width="' + (W-redLand.minX) + '" height="' + H + '" fill="#bf775c" opacity=".17"/>'
    + stippling + '<g data-cartography="woods">' + woods + '</g>'
    + blockedRidgesArt('atlas')
    + '<path d="M' + blueLand.maxX + ' 126V954" fill="none" stroke="#315e85" stroke-width="2.7" stroke-dasharray="13 10" opacity=".77"/>'
    + '<path d="M' + redLand.minX + ' 126V954" fill="none" stroke="#9c493b" stroke-width="2.7" stroke-dasharray="13 10" opacity=".77"/>'
    + '<text x="435" y="190" fill="#365c7d" text-anchor="middle" letter-spacing="5" font-family="Georgia,serif" font-size="22" opacity=".8">BLUE KINGDOM</text>'
    + '<text x="1485" y="190" fill="#924a3e" text-anchor="middle" letter-spacing="5" font-family="Georgia,serif" font-size="22" opacity=".8">RED KINGDOM</text>'
    + '<text x="' + borderX + '" y="226" fill="#6f593c" text-anchor="middle" letter-spacing="1" font-family="Georgia,serif" font-style="italic" font-size="18">No Man&#39;s Land</text>'
    + compass(W/2, 685)
    + '</g>'
    + '<use href="#atlas-coast" fill="none" stroke="#473b2c" stroke-width="2.5"/>'
    + '<rect ' + full + ' fill="url(#atlas-grain)" opacity=".3"/>'
    + '<rect ' + full + ' fill="url(#atlas-vignette)"/>'
    + ornaments(x,y,view.width,view.height)
    + '</svg>';
}
