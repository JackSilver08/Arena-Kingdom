import { ATLAS_COLORS as C } from './atlasStyle';
import type { ArtQuality } from './terrainArt';

const f = (v: number) => v.toFixed(1);
const h = (v: number) => {
  const t = Math.sin(v * 127.1 + 78.233) * 43758.5453;
  return t - Math.floor(t);
};

function pine(x: number, y: number, scale: number, tilt: number) {
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(tilt)}) scale(${f(scale)})" stroke-linejoin="round" stroke-linecap="round">
    <path d="M0 5v22" stroke="#6c5540" stroke-width="3"/>
    <path d="M0-24L-8-10h4L-14 5h5l-9 12Q0 21 17 17L8 5h5L5-10h4Z" fill="#819879" stroke="#415d4e" stroke-width="2.4"/>
    <path d="M0-21L-5-8h5L-10 8l8-2" stroke="#d7d5ab" stroke-width="2" fill="none"/>
    <path d="M3-15l3 10m-3 6 7 9" stroke="#4e6651" stroke-width="1.1"/>
  </g>`;
}

function broadleaf(x: number, y: number, scale: number, tilt: number) {
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(tilt)}) scale(${f(scale)})" stroke-linejoin="round" stroke-linecap="round">
    <path d="M0 1v23m0-10-8-8m8 3 11-12" fill="none" stroke="#6c5540" stroke-width="3.2"/>
    <path d="M-1 5Q-13 10-18 0q-12-11 2-20 6-15 20-7 14-8 21 8Q37-7 23 3 15 13-1 5Z" fill="#9bab83" stroke="#4e6250" stroke-width="2.3"/>
    <path d="M-17-11q8-10 16-3m3-5q11-4 16 4M-13 1q12 5 20 0m9-8q8 3 9 7" fill="none" stroke="#55705a" stroke-width="1.3"/>
  </g>`;
}

function grove(x: number, y: number, count: number, rx: number, ry: number, seed: number) {
  const wash = `<path d="M${f(x-rx)} ${f(y)}Q${f(x-rx*.9)} ${f(y-ry*1.2)} ${f(x+rx*.2)} ${f(y-ry*.9)}Q${f(x+rx*1.15)} ${f(y-ry*.4)} ${f(x+rx)} ${f(y+ry*.35)}Q${f(x+rx*.2)} ${f(y+ry*1.15)} ${f(x-rx*.8)} ${f(y+ry*.7)}Z" fill="${C.forest}" opacity=".22" stroke="#76856e" stroke-width="2" stroke-opacity=".22"/>`;
  const trees = Array.from({length:count}, (_,i) => {
    const n = seed + i * 11;
    return {x:x+(h(n)-.5)*rx*1.65, y:y+(h(n+1)-.5)*ry*1.45, scale:.44 + h(n+2)*.37, tilt:(h(n+3)-.5)*14, isPine:h(n+4)>.54};
  }).sort((a,b)=>a.y-b.y).map(t=>t.isPine?pine(t.x,t.y,t.scale,t.tilt):broadleaf(t.x,t.y,t.scale,t.tilt)).join('');
  return `<g data-grove="ink">${wash}${trees}</g>`;
}

export function engravedGroves(quality: ArtQuality, nature: boolean, worldWidth: number) {
  const density = quality === 'high' ? 1 : quality === 'medium' ? .78 : .58;
  const multiplier = nature ? density : density * .5;
  const places:ReadonlyArray<[number,number,number,number,number]> = [
    [340,244,10,103,61], [520,284,11,95,83], [365,370,6,65,45],
    [590,382,7,73,45], [390,686,9,94,75], [580,765,14,116,77],
    [690,684,7,75,65], [280,738,6,55,68]
  ];
  return places.map(([gx,gy,n,rx,ry],i)=>{
    const count=Math.max(2,Math.round(n*multiplier));
    return grove(gx,gy,count,rx,ry,i*47+17)
      +grove(worldWidth-gx,gy,count,rx,ry,i*47+17);
  }).join('');
}

export function terrainHatching(quality: ArtQuality) {
  const n = quality==='low'?36:quality==='medium'?62:88;
  return Array.from({length:n},(_,i)=>{
    const x=230+h(i*19+21)*1460, y=170+h(i*19+22)*735;
    const w=8+h(i*19+23)*17, bend=(h(i*19+24)-.5)*9;
    return `<path d="M${f(x-w)} ${f(y+bend)}q${f(w*.6)} -6 ${f(w)} -2t${f(w)} 2" stroke="#947c5c" stroke-width="1.2" stroke-linecap="round" opacity=".26" fill="none"/>`;
  }).join('');
}

export function terrainWashes() {
  const patches: ReadonlyArray<[number,number,number,number,string,number]> = [
    [365,268,210,125,'#a6b390',.26], [480,710,230,150,'#9fa77a',.18],
    [640,480,280,195,'#dcc896',.22], [1300,340,230,145,'#caa48a',.21],
    [1495,695,245,185,'#cfaa8c',.2], [1200,775,200,150,'#d7ba94',.17]
  ];
  return patches.map(([x,y,rx,ry,color,alpha],i)=>{
    const t=(i%3)*9;
    const d=`M${x-rx} ${y-18}C${x-rx*.85} ${y-ry} ${x-rx*.22} ${y-ry*1.02} ${x+rx*.2} ${y-ry*.76}C${x+rx*.88} ${y-ry*.82} ${x+rx*1.02} ${y-ry*.18} ${x+rx} ${y+ry*.26}C${x+rx*.82} ${y+ry*.96} ${x+rx*.13} ${y+ry*.9} ${x-rx*.36} ${y+ry*.92}C${x-rx*.94} ${y+ry*.6} ${x-rx*1.01} ${y+ry*.22} ${x-rx} ${y-18}Z`;
    return `<path data-wash="relief-${i}" d="${d}" fill="${color}" opacity="${alpha}" transform="translate(${t-9} 0)"/>`;
  }).join('');
}
