import { GAME_RULES, MOUNTAIN_RIDGES, coastline, coastSamples, startingLayout } from '@arena-kingdom/shared';
import type { MapViewSize } from './mapArt';
import { blockedRidgesArt, type ArtQuality } from './terrainArt';

/** Original vector terrain. No rendered concept, foreign asset or baked-in entity. */
const cache = new Map<string, string>();
const n = (value: number) => value.toFixed(1);
const noise = (i: number) => { const v = Math.sin(i * 127.1 + 31.7) * 43758.5453; return v - Math.floor(v); };

function pine(x: number, y: number, size: number, id: number) {
  const tone = id % 2 ? '#284b3c' : '#315943';
  return `<g transform="translate(${n(x)} ${n(y)}) scale(${n(size)})">
    <ellipse cx="4" cy="8" rx="14" ry="5" fill="#172e2d" opacity=".35"/>
    <path d="M-2 3h4v7h-4" fill="#6b5941"/>
    <path d="M0-30L-9-13h4L-14-3h6L-17 6Q0 12 17 6L8-3h6L5-13h4Z" fill="${tone}" stroke="#203d32" stroke-width="1"/>
    <path d="M0-28L-8-13h5L-12-3h6L-13 5 0 2Z" fill="#61825b" opacity=".7"/>
    <path d="M0-18L5-12M0-7l9 5M0 4l11 2" fill="none" stroke="#769361" opacity=".3"/>
  </g>`;
}

function basePaving(side: 'blue' | 'red') {
  return `<g data-base-paving="${side}">${startingLayout(side).buildings.map(b => {
    const r = b.type === 'castle' ? 70 : 39;
    const outline = `M${-r} 2Q${-r * .9} ${-r * .4} ${-r * .35} ${-r * .48}L${r * .24} ${-r * .52}Q${r * .8} ${-r * .4} ${r} ${-r * .03}L${r * .83} ${r * .29}Q${r * .4} ${r * .57} ${-r * .12} ${r * .48}L${-r * .75} ${r * .33}Z`;
    return `<g transform="translate(${b.x} ${b.y})"><path d="${outline}" transform="translate(3 4)" fill="#344d3d" opacity=".35"/>
      <path d="${outline}" fill="#8a9379" stroke="#a7aa87" stroke-width="1.2"/>
      <path d="${outline}" transform="scale(.9)" fill="url(#paving)"/>
      <path d="M${-r * .7} ${r * .29}l${r * .3} 5m${r * .7} -3 ${r * .3} -5" stroke="#c1bd98" opacity=".5"/></g>`;
  }).join('')}</g>`;
}

export function arenaMapArtMoba(view: MapViewSize = GAME_RULES.map, quality: ArtQuality = 'high', nature = true) {
  const key = `${view.width}:${view.height}:${quality}:${nature}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const { width: W, height: H } = GAME_RULES.map;
  const x = (W - view.width) / 2, y = (H - view.height) / 2;
  const full = `x="${x}" y="${y}" width="${view.width}" height="${view.height}"`;
  const coast = 'M' + coastline(640).map(p => `${n(p.x)} ${n(p.y)}`).join('L') + 'Z';
  const shore = coastSamples(220).map(p => ({ x: p.x + p.nx * p.margin, y: p.y + p.ny * p.margin, nx: p.nx, ny: p.ny }));
  const shorelineStone = shore.map((p, i) => {
    const q = shore[(i + 1) % shore.length];
    const depth = 7 + noise(i + 82) * 7;
    return `<path d="M${n(p.x)} ${n(p.y)}L${n(q.x)} ${n(q.y)} ${n(q.x + 3)} ${n(q.y + depth)} ${n(p.x + 3)} ${n(p.y + depth)}Z" fill="${['#4f686a', '#6c7c72', '#3a585e', '#8e9680'][i % 4]}" stroke="#3d5c5e" stroke-width=".6"/>`;
  }).join('');
  const density = quality === 'low' ? 75 : quality === 'medium' ? 135 : 210;
  const tonalMasses = Array.from({ length: quality === 'low' ? 24 : 42 }, (_, i) => {
    const px = 160 + noise(i * 3 + 651) * 710, py = 155 + noise(i * 3 + 652) * 770;
    const size = 70 + noise(i * 3 + 653) * 110;
    const shape = `<path d="M-1-.48C-.4-.8-.15-.42.17-.55S.83-.38 1-.08 .53.27.45.46-.19.38-.43.56-1.07.03-1-.48Z" fill="url(#${i % 3 ? 'sun-grass' : 'deep-grass'})"/>`;
    return `<g transform="translate(${n(px)} ${n(py)}) scale(${n(size)} ${n(size * .57)})">${shape}</g><g transform="translate(${n(W - px)} ${n(py)}) scale(${n(size)} ${n(size * .57)})">${shape}</g>`;
  }).join('');
  const meadow = Array.from({ length: density }, (_, i) => {
    const px = 200 + noise(i * 2) * 1520, py = 175 + noise(i * 2 + 1) * 720;
    const size = 15 + noise(i + 701) * 25;
    return `<ellipse cx="${n(px)}" cy="${n(py)}" rx="${n(size)}" ry="${n(size * .45)}" fill="${i % 3 ? '#a1b277' : '#365e43'}" opacity=".07"/>
      ${nature ? `<path d="M${n(px)} ${n(py)}l-2-5m3 5 2-7m0 7 4-3" fill="none" stroke="#b2bc7a" stroke-width="1" opacity=".35"/>` : ''}`;
  }).join('');
  // Tall groves are confined to actual blocked footprints and the shore, never fake lane obstacles.
  const ridgeTrees = nature ? MOUNTAIN_RIDGES.map((r, i) =>
    Array.from({ length: quality === 'low' ? 2 : 4 }, (_, j) => pine(r.cx - r.rx * .5 + j * r.rx * .28, r.cy - r.ry * .35, .5 + noise(i + j + 300) * .22, j)).join('')
  ).join('') : '';
  const coastTrees = nature ? shore.filter((_, i) => i % (quality === 'low' ? 16 : 12) === 0).map((p, i) => {
    const count = quality === 'low' ? 3 : 5;
    const group = Array.from({ length: count }, (_, j) => {
      const along = (j - count / 2) * 14;
      const inward = 7 + noise(i * 7 + j) * 20;
      return { x: p.x - p.ny * along - p.nx * inward, y: p.y + p.nx * along - p.ny * inward, scale: .8 + noise(i * 11 + j) * .65 };
    }).sort((a, b) => a.y - b.y);
    return group.map((g, j) => pine(g.x, g.y, g.scale, i + j)).join('');
  }).join('') : '';
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${view.width} ${view.height}">
    <defs>
      <path id="fantasy-coast" d="${coast}"/>
      <clipPath id="fantasy-land"><use href="#fantasy-coast"/></clipPath>
      <linearGradient id="sea" x2=".3" y2="1"><stop stop-color="#163d50"/><stop offset=".55" stop-color="#205566"/><stop offset="1" stop-color="#112f40"/></linearGradient>
      <linearGradient id="meadow" x2=".2" y2="1"><stop stop-color="#758a59"/><stop offset=".4" stop-color="#617d50"/><stop offset="1" stop-color="#496b4c"/></linearGradient>
      <radialGradient id="sun-grass"><stop stop-color="#a9b779" stop-opacity=".35"/><stop offset=".67" stop-color="#8fa56c" stop-opacity=".2"/><stop offset="1" stop-color="#8fa56c" stop-opacity="0"/></radialGradient>
      <radialGradient id="deep-grass"><stop stop-color="#294f3c" stop-opacity=".32"/><stop offset=".72" stop-color="#40664a" stop-opacity=".19"/><stop offset="1" stop-color="#40664a" stop-opacity="0"/></radialGradient>
      <pattern id="grass-grain" width="58" height="43" patternUnits="userSpaceOnUse"><path d="M4 15l5-2m19 16 8-2m11-19 3-1M15 40l4-2" stroke="#b2bd88" opacity=".18"/><circle cx="35" cy="10" r="1" fill="#365641" opacity=".25"/></pattern>
      <pattern id="water-ripples" width="94" height="64" patternUnits="userSpaceOnUse"><path d="M3 16q16-5 32 0m22 21q17-5 34 0M9 56q13-3 26 0" fill="none" stroke="#a1d6cf" stroke-width="1.4" opacity=".22"/></pattern>
      <pattern id="paving" width="32" height="23" patternUnits="userSpaceOnUse"><path d="M1 3L16 1l-1 9-13 1Zm18-1 12 2-2 7-11-1ZM1 14l10-1 2 8H2Zm14-1 14 1 1 7-15 1Z" fill="#929a82" stroke="#697762" stroke-width=".8"/><path d="M3 4l10-2m7 1 8 2M3 15h6m8-1 10 1" stroke="#c8c3a3" opacity=".5"/></pattern>
      <radialGradient id="edge-shade"><stop offset=".6" stop-color="#112d32" stop-opacity="0"/><stop offset="1" stop-color="#0a2230" stop-opacity=".28"/></radialGradient>
    </defs>
    <rect ${full} fill="url(#sea)"/>
    <rect ${full} fill="url(#water-ripples)" opacity=".6"/>
    <use href="#fantasy-coast" transform="translate(5 11)" fill="#142e36" stroke="#122f38" stroke-width="24" opacity=".55"/>
    <use href="#fantasy-coast" fill="#68796a" stroke="#77a2a0" stroke-width="13"/>
    ${shorelineStone}
    <use href="#fantasy-coast" fill="url(#meadow)"/>
    <g clip-path="url(#fantasy-land)">
      <use href="#fantasy-coast" fill="none" stroke="#a6ad83" stroke-width="12" opacity=".48"/>
      <use href="#fantasy-coast" fill="url(#grass-grain)"/>
      ${tonalMasses}
      ${meadow}
      ${basePaving('blue')}${basePaving('red')}
      ${blockedRidgesArt('moba')}
      ${nature ? `<g data-nature="true">${ridgeTrees}${coastTrees}</g>` : ''}
    </g>
    <use href="#fantasy-coast" fill="none" stroke="#d0d4b5" stroke-width="2" opacity=".48"/>
    <rect ${full} fill="url(#edge-shade)"/>
  </svg>`;
  cache.set(key, markup);
  if (cache.size > 3) cache.delete(cache.keys().next().value!);
  return markup;
}
