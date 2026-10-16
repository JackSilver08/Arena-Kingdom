import { GAME_RULES, coastline, coastSamples } from '@arena-kingdom/shared';
import { blockedRidgesArt, type ArtQuality } from './terrainArt';
import { engravedGroves, terrainHatching, terrainWashes } from './campaignEngraving';
import { ATLAS_COLORS as C, ATLAS_MAP_VERSION } from './atlasStyle';
import type { MapViewSize } from './mapArt';

const f=(v:number)=>v.toFixed(1);

function waveCoast(samples: ReturnType<typeof coastSamples>) {
  return [12,23,36].map((offset,i)=>{
    const outline=samples.map(p=>`${f(p.x+p.nx*(p.margin+offset))} ${f(p.y+p.ny*(p.margin+offset))}`).join('L');
    return `<path d="M${outline}Z" fill="none" stroke="${C.seaLine}" stroke-width="${i===0?2.8:1.3}" opacity="${.55-i*.13}"/>`;
  }).join('');
}

function windrose(cx:number,cy:number) {
  const arms=Array.from({length:8},(_,i)=>{
    const length=i%2?17:29;
    return `<g transform="rotate(${i*45})"><path d="M0 0L-4-6L0-${length}Z" fill="${i%2?'#c4b28e':C.ink}" stroke="${C.ink}" stroke-width=".8"/><path d="M0 0L4-6L0-${length}Z" fill="${C.paperLight}" stroke="${C.ink}" stroke-width=".8"/></g>`;
  }).join('');
  return `<g data-cartography="compass" transform="translate(${cx} ${cy})">
    <circle r="32" fill="${C.paperLight}" opacity=".94" stroke="${C.inkSoft}" stroke-width="1.5"/>
    <circle r="25" fill="none" stroke="${C.inkSoft}" stroke-dasharray="2 5"/>
    ${arms}<circle r="4" fill="${C.red}" stroke="${C.ink}"/>
    <text x="0" y="-42" text-anchor="middle" fill="${C.ink}" font-family="Georgia,serif" font-weight="bold" font-size="16">N</text>
  </g>`;
}

function plateBorder(x:number,y:number,w:number,h:number) {
  const right=x+w,bottom=y+h;
  const corner=(px:number,py:number,sx:number,sy:number)=>`<g transform="translate(${px} ${py}) scale(${sx} ${sy})" fill="none" stroke="${C.inkSoft}" stroke-width="1.6"><path d="M0 54Q0 0 54 0M7 38Q13 12 38 7M9 18q11 1 10 11"/><path d="M12 13l9 2-5 11-4-13Z" fill="#bf9d6c" opacity=".6"/></g>`;
  return `<g data-cartography="frame" pointer-events="none">
    <rect x="${x+9}" y="${y+9}" width="${w-18}" height="${h-18}" fill="none" stroke="#604d39" stroke-width="5"/>
    <rect x="${x+17}" y="${y+17}" width="${w-34}" height="${h-34}" fill="none" stroke="#bd9869" stroke-width="2"/>
    <path d="M${x+36} ${y+23}H${right-36}M${x+36} ${bottom-23}H${right-36}" fill="none" stroke="${C.inkSoft}" stroke-width="1.2" stroke-dasharray="27 5 2 5"/>
    ${corner(x+17,y+17,1,1)}${corner(right-17,y+17,-1,1)}${corner(x+17,bottom-17,1,-1)}${corner(right-17,bottom-17,-1,-1)}
    <text x="${x+w/2}" y="${y+37}" fill="${C.inkSoft}" font-size="10" letter-spacing="4" text-anchor="middle" font-family="Georgia,serif">CAMPAIGN THEATRE</text>
    <text x="${x+w/2}" y="${bottom-32}" fill="${C.inkSoft}" font-size="10" letter-spacing="3" text-anchor="middle" font-family="Georgia,serif">ARENA KINGDOM - HISTORICAL FIELD ATLAS</text>
  </g>`;
}

function regionLabel(x:number,y:number,label:string,color:string,subline:string) {
  return `<g data-cartography="territory-label" fill="${color}" font-family="Georgia,serif" text-anchor="middle">
    <text x="${x}" y="${y}" font-size="22" letter-spacing="5" stroke="${C.paperLight}" stroke-width="3.5" paint-order="stroke" opacity=".87">${label}</text>
    <text x="${x}" y="${y+23}" font-size="10.5" letter-spacing="3" opacity=".66">${subline}</text>
  </g>`;
}

export function arenaMapArtAtlas(view:MapViewSize=GAME_RULES.map,quality:ArtQuality='medium',nature=true):string {
  const {width:W,height:H,blueLand,redLand}=GAME_RULES.map;
  const x=(W-view.width)/2,y=(H-view.height)/2;
  const box=`x="${x}" y="${y}" width="${view.width}" height="${view.height}"`;
  const coast=`M${coastline(480).map(p=>`${f(p.x)} ${f(p.y)}`).join('L')}Z`;
  const left=blueLand.maxX,right=redLand.minX;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${view.width} ${view.height}" data-map-style="atlas" data-campaign-plate="${ATLAS_MAP_VERSION}">
    <defs>
      <path id="atlas-coast" d="${coast}"/>
      <clipPath id="atlas-land"><use href="#atlas-coast"/></clipPath>
      <pattern id="atlas-waves" width="92" height="64" patternUnits="userSpaceOnUse">
        <path d="M5 14q12-5 26 0m19 27q12-4 29 1M-4 61q13-4 31 0" fill="none" stroke="${C.seaLine}" stroke-width="1.5" stroke-linecap="round" opacity=".45"/>
      </pattern>
      <pattern id="atlas-grain" width="66" height="52" patternUnits="userSpaceOnUse">
        <circle cx="5" cy="14" r="1" fill="#634c37" opacity=".15"/>
        <circle cx="34" cy="43" r=".9" fill="#7a6548" opacity=".2"/>
        <path d="M18 12l4 -1m30 17l5-2m-19-20l2 2" fill="none" stroke="#9d8464" stroke-width="1" opacity=".2"/>
      </pattern>
      <linearGradient id="atlas-ocean" x2="0.85" y2="1">
        <stop stop-color="#b5d0d6"/><stop offset=".65" stop-color="${C.sea}"/><stop offset="1" stop-color="#82a8b5"/>
      </linearGradient>
      <linearGradient id="atlas-land-fill" x2=".65" y2="1">
        <stop stop-color="${C.paperLight}"/><stop offset=".72" stop-color="${C.paper}"/><stop offset="1" stop-color="${C.paperShadow}"/>
      </linearGradient>
    </defs>
    <rect ${box} fill="${C.paperShadow}"/>
    <rect ${box} fill="url(#atlas-ocean)"/>
    <rect ${box} fill="url(#atlas-waves)"/>
    ${waveCoast(coastSamples(220))}
    <use href="#atlas-coast" transform="translate(2 5)" fill="#54736e" opacity=".2"/>
    <use href="#atlas-coast" fill="url(#atlas-land-fill)" stroke="${C.ink}" stroke-width="3.5"/>
    <g clip-path="url(#atlas-land)">
      <rect ${box} fill="url(#atlas-grain)"/>
      <rect x="0" y="0" width="${left}" height="${H}" fill="#bbc7ad" opacity=".19"/>
      <rect x="${right}" y="0" width="${W-right}" height="${H}" fill="#cf8e77" opacity=".17"/>
      <rect x="${left}" y="0" width="${right-left}" height="${H}" fill="${C.contested}" opacity=".35"/>
      <g data-cartography="watercolor-relief">${terrainWashes()}</g>
      <g data-cartography="terrain-ink">${terrainHatching(quality)}</g>
      <g data-cartography="woods">${engravedGroves(quality,nature,W)}</g>
      <g data-cartography="mountains">${blockedRidgesArt('atlas')}</g>
      <path d="M${left} 120V960" fill="none" stroke="${C.blue}" stroke-width="2.1" stroke-dasharray="9 8" opacity=".75"/>
      <path d="M${right} 120V960" fill="none" stroke="${C.red}" stroke-width="2.1" stroke-dasharray="9 8" opacity=".75"/>
      ${regionLabel(460,207,'BLUE KINGDOM',C.blue,'WESTERN MARCH')}
      ${regionLabel(1460,207,'RED KINGDOM',C.red,'EASTERN MARCH')}
      <text x="${W/2}" y="225" fill="${C.inkSoft}" font-size="18" font-family="Georgia,serif" font-style="italic" text-anchor="middle" stroke="${C.paper}" stroke-width="4" paint-order="stroke">No Man's Land</text>
    </g>
    <use href="#atlas-coast" fill="none" stroke="#a99472" stroke-width="7" opacity=".55"/>
    <use href="#atlas-coast" fill="none" stroke="${C.ink}" stroke-width="2.2"/>
    <text x="${W/2}" y="100" fill="#4c6f7e" font-family="Georgia,serif" font-style="italic" font-size="17" text-anchor="middle" letter-spacing="3" opacity=".8">Northern Sea</text>
    <text x="${W/2}" y="1020" fill="#4c6f7e" font-family="Georgia,serif" font-style="italic" font-size="17" text-anchor="middle" letter-spacing="3" opacity=".75">Southern Waters</text>
    ${windrose(960,946)}
    <rect ${box} fill="url(#atlas-grain)" opacity=".13" pointer-events="none"/>
    ${plateBorder(x,y,view.width,view.height)}
  </svg>`;
}
