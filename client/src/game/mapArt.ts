import { COAST_PERIMETER, GAME_RULES, coastSamples, type CoastSample } from '@arena-kingdom/shared';
import type { MapStyle } from './displaySettings';

/**
 * Arena Kingdom battlefield drawn as an old military campaign map: one island on aged paper,
 * shared by both kingdoms. Rendering only: the coastline comes from shared/island.ts, so the drawn
 * shore is exactly where troops stop and fences may reach.
 *
 * Keep the markup ASCII (use XML entities): it is Base64-encoded with `btoa`.
 */
const svg=(viewBox:string,body:string)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;

interface MapPalette {
  paper:string;
  ink:string;
  blueInk:string;
  redInk:string;
  water:string;
  land:string;
  coast:string;
  shore:string;
  woods:string;
  treeFill:string;
  treeStroke:string;
  hillFill:string;
  hillStroke:string;
  grain:string;
  stain:string;
  vignette:string;
  foldLight:string;
  foldDark:string;
  gridOpacity:number;
  waterOpacity:number;
  woodsOpacity:number;
  ageOpacity:number;
  foldOpacity:number;
  roughness:number;
  frameWidth:number;
}

const DOCUMENTARY:MapPalette={
  paper:'#eee6d2', ink:'#29323a', blueInk:'#365b83', redInk:'#8a4038',
  water:'#7f979d', land:'#e5dfca', coast:'#506a70', shore:'#b49b70',
  woods:'#98a477', treeFill:'#d0caa6', treeStroke:'#566047',
  hillFill:'#987c52', hillStroke:'#7e6849', grain:'#574632', stain:'#70563b',
  vignette:'#67563e', foldLight:'#fff8e5', foldDark:'#64513a',
  gridOpacity:.15, waterOpacity:.27, woodsOpacity:.48, ageOpacity:0,
  foldOpacity:0, roughness:1.8, frameWidth:2.4
};

const VINTAGE:MapPalette={
  paper:'#e9d9b1', ink:'#3a2a18', blueInk:'#2c4a78', redInk:'#8c2b22',
  water:'#6d8c90', land:'#efe3c0', coast:'#3f5b5c', shore:'#b89560',
  woods:'#a7ad73', treeFill:'#cfc795', treeStroke:'#4f5a2a',
  hillFill:'#9c7443', hillStroke:'#86653d', grain:'#5c3f1e', stain:'#7a5228',
  vignette:'#6b4a22', foldLight:'#fff6dc', foldDark:'#6b4a22',
  gridOpacity:.2, waterOpacity:.34, woodsOpacity:.55, ageOpacity:.2,
  foldOpacity:.35, roughness:3.5, frameWidth:2.6
};

function palette(style:MapStyle):MapPalette {
  return style==='vintage' ? VINTAGE : DOCUMENTARY;
}

const FONT=`font-family="Georgia, 'Times New Roman', serif"`;
/** Map sheet: coordinates and the scale live in the margin between the frame and the neatline. */
const NEATLINE=46;
const GRID=120;
/** Woods fade out over this band before the midline, so the mirrored halves never meet in a symmetric blot. */
const WOODS_FADE={from:190,to:70};

const SAMPLE_SPACING=7;
/** Baseline of the kingdom names near the top of the island. */
const LABEL_Y=210;

type Point=[number,number];
const fmt=([x,y]:Point)=>`${x.toFixed(1)} ${y.toFixed(1)}`;

/** Deterministic hash noise in [-1, 1]. */
const hash=(i:number,seed:number)=>{const v=Math.sin(i*127.1+seed*311.7)*43758.5453;return(v-Math.floor(v))*2-1;};

/** A smooth closed curve through `points`, using quadratic curves between midpoints. */
function smoothClosed(points:Point[]){
  const mid=(i:number):Point=>{const a=points[i],b=points[(i+1)%points.length];return[(a[0]+b[0])/2,(a[1]+b[1])/2];};
  return`M${fmt(mid(points.length-1))}`+points.map((p,i)=>`Q${fmt(p)} ${fmt(mid(i))}`).join('')+'Z';
}

const along=({x,y,nx,ny,margin}:CoastSample,outset:number):Point=>[x+nx*(margin+outset),y+ny*(margin+outset)];

/**
 * The coastline pushed `outset` further out, with a ragged hand-inked edge baked into the
 * geometry because an SVG displacement filter over the whole map is slow to rasterise.
 */
function coastPath(samples:CoastSample[],outset:number,rough:number,seed:number){
  const n=samples.length;
  const coarse=(i:number)=>{const a=Math.floor(i/4),f=i/4-a,u=f*f*(3-2*f);return hash(a%(n/4),seed)*(1-u)+hash((a+1)%(n/4),seed)*u;};
  return'M'+samples.map((s,i)=>fmt(along(s,outset+rough*(.65*coarse(i)+.35*hash(i,seed+1))))).join('L')+'Z';
}

/** A smooth, sparsely sampled copy of the coastline, for the engraved water lines around the island. */
const waterLine=(samples:CoastSample[],outset:number)=>smoothClosed(samples.filter((_,i)=>i%3===0).map(s=>along(s,outset)));

/** Contour rings with a spot height; `mirror` draws the same hill reflected for the red half. */
function hill(cx:number,cy:number,rx:number,ry:number,height:number,seed:number,mirror=false,colors:MapPalette=VINTAGE){
  const flip=(x:number)=>mirror?GAME_RULES.map.width-x:x;
  const rings=[1,.72,.46,.22].map((scale,ring)=>smoothClosed(Array.from({length:32},(_,i):Point=>{
    const t=i/32*Math.PI*2;
    const wobble=1+.13*Math.sin(3*t+seed+ring*.6)+.07*Math.sin(5*t+seed*2.3);
    return[flip(cx+Math.cos(t)*rx*scale*wobble),cy+Math.sin(t)*ry*scale*wobble];
  })));
  const x=flip(cx);
  return`<path d="${rings.join('')}" fill="${colors.hillFill}" fill-opacity=".07" stroke="${colors.hillStroke}" stroke-width="1.3"/>
    <path d="M${x-4} ${cy+3}h8l-4-7z" fill="${colors.ink}"/>
    <text x="${x+7}" y="${cy+4}" font-size="12" fill="${colors.ink}" stroke="${colors.paper}" stroke-width="5" stroke-opacity=".9" paint-order="stroke" ${FONT}>${height}</text>`;
}

/** Eight-point compass rose with alternating inked and blank halves. */
function compassRose(cx:number,cy:number,r:number,colors:MapPalette=VINTAGE){
  const point=(angle:number,length:number,width:number)=>`<g transform="rotate(${angle})">
      <path d="M0 ${-length}L${width} ${-width}L0 0Z" fill="${colors.ink}"/><path d="M0 ${-length}L${-width} ${-width}L0 0Z" fill="${colors.paper}" stroke="${colors.ink}" stroke-width="1"/>
    </g>`;
  return`<g transform="translate(${cx} ${cy})" opacity=".62">
    <circle r="${r*.74}" fill="none" stroke="${colors.ink}" stroke-width="1.2"/>
    <circle r="${r*.66}" fill="none" stroke="${colors.ink}" stroke-width=".8" stroke-dasharray="2 5"/>
    ${[45,135,225,315].map(a=>point(a,r*.62,r*.09)).join('')}
    ${[0,90,180,270].map(a=>point(a,r,r*.13)).join('')}
    <circle r="3" fill="${colors.ink}"/>
    <text y="${-r-8}" text-anchor="middle" font-size="18" font-weight="bold" fill="${colors.ink}" stroke="${colors.paper}" stroke-width="5" stroke-opacity=".9" paint-order="stroke" ${FONT}>N</text>
  </g>`;
}

/** The part of the world a map is drawn for; the battlefield always sits in its centre. */
export interface MapViewSize{width:number;height:number}

/** Grid cells whose centre falls inside [min, max], numbered from the first visible one. */
function gridCentres(min:number,max:number){
  const first=Math.ceil((min-GRID/2)/GRID),last=Math.floor((max-GRID/2)/GRID);
  return Array.from({length:Math.max(0,last-first+1)},(_,i)=>GRID/2+(first+i)*GRID);
}

/** The map sheet: frame, graduated neatline, grid references, scale bar and title. */
function sheet({x,y,width,height}:{x:number;y:number;width:number;height:number},colors:MapPalette,style:MapStyle){
  const right=x+width,bottom=y+height,n=NEATLINE-3;
  const label=(lx:number,ly:number,text:string|number)=>`<text x="${lx}" y="${ly}" text-anchor="middle">${text}</text>`;
  // Graduation marks line up with the world grid whatever the sheet size.
  const phase=(v:number)=>((v%60)+60)%60;
  const graduation=(d:string,offset:number)=>`<path d="${d}" fill="none" stroke="${colors.ink}" stroke-width="6" stroke-dasharray="60 60" stroke-dashoffset="${phase(offset)}"/>`;
  const scale=Array.from({length:5},(_,i)=>`<rect x="${x+70+i*48}" y="${bottom-33}" width="48" height="6" fill="${i%2?colors.paper:colors.ink}"/>`).join('');
  const plate=style==='vintage'?'VINTAGE PLATE':'DOCUMENTARY PLATE';
  return`
    <rect x="${x+8}" y="${y+8}" width="${width-16}" height="${height-16}" fill="none" stroke="${colors.ink}" stroke-width="${colors.frameWidth}"/>
    <rect x="${x+14}" y="${y+14}" width="${width-28}" height="${height-28}" fill="none" stroke="${colors.ink}" stroke-width=".8"/>
    ${graduation(`M${x+n} ${y+n}H${right-n}M${x+n} ${bottom-n}H${right-n}`,x+n)}
    ${graduation(`M${x+n} ${y+n}V${bottom-n}M${right-n} ${y+n}V${bottom-n}`,y+n)}
    <rect x="${x+NEATLINE}" y="${y+NEATLINE}" width="${width-2*NEATLINE}" height="${height-2*NEATLINE}" fill="none" stroke="${colors.ink}" stroke-width="1.6"/>
    <g font-size="14" fill="${colors.ink}" ${FONT}>
      ${gridCentres(x+NEATLINE,right-NEATLINE).map((cx,i)=>label(cx,y+34,String.fromCharCode(65+i))).join('')}
      ${gridCentres(y+NEATLINE,bottom-NEATLINE).map((cy,i)=>label(x+29,cy+5,i+1)+label(right-29,cy+5,i+1)).join('')}
    </g>
    <g ${FONT} fill="${colors.ink}">
      ${scale}<rect x="${x+70}" y="${bottom-33}" width="240" height="6" fill="none" stroke="${colors.ink}" stroke-width="1"/>
      <g font-size="11" text-anchor="middle">${[0,1,2,3,4,5].map(i=>label(x+70+i*48,bottom-17,i)).join('')}</g>
      <text x="${x+324}" y="${bottom-25}" font-size="12" font-style="italic">leagues</text>
      <text x="${x+width/2}" y="${bottom-19}" font-size="13" text-anchor="middle" letter-spacing="3">SCALE 1 : 50 000</text>
      <text x="${right-70}" y="${bottom-19}" font-size="13" text-anchor="end" letter-spacing="3">ARENA KINGDOM &#183; ${plate} &#183; SHEET I</text>
    </g>`;
}

/**
 * The battlefield map. `view` may be larger than the world, e.g. to fill a wide screen: the extra
 * room is open sea and paper, and the sheet's frame follows the view's edges.
 */
export function arenaMapArtV2(view:MapViewSize=GAME_RULES.map,style:MapStyle='documentary'){
  const colors=palette(style);
  const {width:W,height:H,blueLand,redLand}=GAME_RULES.map;
  const sheetRect={x:(W-view.width)/2,y:(H-view.height)/2,width:view.width,height:view.height};
  const full=`x="${sheetRect.x}" y="${sheetRect.y}" width="${view.width}" height="${view.height}"`;
  // A multiple of 4 so the coarse jitter in coastPath wraps cleanly.
  const samples=coastSamples(Math.round(COAST_PERIMETER/SAMPLE_SPACING/4)*4);
  const waterLines=[14,25,38,53,70,90].map((outset,i)=>
    `<path d="${waterLine(samples,outset)}" stroke-width="${(1.5-i*.12).toFixed(2)}" opacity="${(.7-i*.09)*colors.waterOpacity/.34}"/>`).join('');
  // Front lines: the edge of each kingdom's buildable half, with teeth pointing at no man's land.
  const teeth=(x:number,dir:number)=>Array.from({length:Math.ceil(H/24)},(_,i)=>`M${x} ${i*24+6}h${dir*9}`).join('');
  const frontLine=(x:number,dir:number,color:string)=>
    `<path d="M${x} 0V${H}" stroke="${color}" stroke-width="2.6" stroke-dasharray="16 8"/><path d="${teeth(x,dir)}" stroke="${color}" stroke-width="2.2"/>`;
  const territoryLabel=(x:number,text:string,color:string)=>
    `<text x="${x}" y="${LABEL_Y}" text-anchor="middle" font-size="22" letter-spacing="7" fill="${color}" stroke="${colors.paper}" stroke-width="5" stroke-opacity=".9" paint-order="stroke" ${FONT}>${text}</text>`;
  const stains=colors.ageOpacity>0?`<rect ${full} fill="${colors.stain}" opacity="${colors.ageOpacity}" filter="url(#stains)"/>`:'';
  const grain=colors.ageOpacity>0?`<rect ${full} fill="${colors.grain}" opacity=".${style==='vintage'?1:0}" filter="url(#grain)"/>`:'';
  const folds=colors.foldOpacity>0?`
    <rect x="${W/2-14}" y="${sheetRect.y}" width="28" height="${view.height}" fill="url(#fold-v)" opacity="${colors.foldOpacity}"/>
    <rect x="${sheetRect.x}" y="${H/2-14}" width="${view.width}" height="28" fill="url(#fold-h)" opacity="${colors.foldOpacity}"/>`:'';
  return svg(`${sheetRect.x} ${sheetRect.y} ${view.width} ${view.height}`,`
    <defs>
      <path id="coast" d="${coastPath(samples,0,colors.roughness,7)}"/>
      <clipPath id="land"><use href="#coast"/></clipPath>
      <clipPath id="map"><rect x="${sheetRect.x+NEATLINE}" y="${sheetRect.y+NEATLINE}" width="${view.width-2*NEATLINE}" height="${view.height-2*NEATLINE}"/></clipPath>
      <!-- Woods are drawn on the blue half only and mirrored, so neither kingdom gets different terrain. -->
      <filter id="forest" filterUnits="userSpaceOnUse" x="0" y="0" width="${W/2}" height="${H}" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".0068" numOctaves="4" seed="11"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  4.1 0 0 0 -2.25"/>
        <feComponentTransfer><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer>
        <feComposite in="SourceGraphic" operator="in"/>
      </filter>
      <filter id="stains" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".0032" numOctaves="2" seed="21"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.4 0 0 0 -1.1"/>
        <feComposite in="SourceGraphic" operator="in"/>
      </filter>
      <filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="1" seed="2"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3 0 0 0 -1.35"/>
        <feComposite in="SourceGraphic" operator="in"/>
      </filter>
      <linearGradient id="woods-fade" gradientUnits="userSpaceOnUse" x1="${W/2-WOODS_FADE.from}" x2="${W/2-WOODS_FADE.to}"><stop stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
      <mask id="woods-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W/2}" height="${H}"><rect width="${W/2}" height="${H}" fill="url(#woods-fade)"/></mask>
      <pattern id="trees" width="30" height="26" patternUnits="userSpaceOnUse">
        <path id="tree" d="M8 11.5v3.5M4 11.5a2.7 2.7 0 0 1 .9-4.9a3.2 3.2 0 0 1 6.2 0a2.7 2.7 0 0 1 .9 4.9z" fill="${colors.treeFill}" stroke="${colors.treeStroke}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"/>
        <use href="#tree" x="15" y="12"/>
      </pattern>
      <pattern id="grid" width="${GRID}" height="${GRID}" patternUnits="userSpaceOnUse"><path d="M${GRID} 0V${GRID}H0" fill="none" stroke="${colors.ink}" stroke-width="1.1"/></pattern>
      <radialGradient id="vignette" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="${colors.vignette}" stop-opacity="0"/><stop offset="1" stop-color="${colors.vignette}" stop-opacity="${style==='vintage'?'.5':'.16'}"/></radialGradient>
      <linearGradient id="fold-v" x1="0" x2="1"><stop stop-color="${colors.foldLight}" stop-opacity="0"/><stop offset=".5" stop-color="${colors.foldLight}" stop-opacity=".7"/><stop offset=".52" stop-color="${colors.foldDark}" stop-opacity=".45"/><stop offset="1" stop-color="${colors.foldDark}" stop-opacity="0"/></linearGradient>
      <linearGradient id="fold-h" x1="0" x2="0" y1="0" y2="1"><stop stop-color="${colors.foldLight}" stop-opacity="0"/><stop offset=".5" stop-color="${colors.foldLight}" stop-opacity=".7"/><stop offset=".52" stop-color="${colors.foldDark}" stop-opacity=".45"/><stop offset="1" stop-color="${colors.foldDark}" stop-opacity="0"/></linearGradient>
    </defs>
    <rect ${full} fill="${colors.paper}"/>
    <g clip-path="url(#map)">
      <rect ${full} fill="${colors.water}" opacity="${colors.waterOpacity}"/>
      <g fill="none" stroke="${colors.coast}">${waterLines}</g>
      <use href="#coast" fill="${colors.land}" stroke="${colors.coast}" stroke-width="16" stroke-opacity=".12"/>
      <g clip-path="url(#land)">
        <use href="#coast" fill="none" stroke="${colors.shore}" stroke-width="22" stroke-opacity=".35"/>
        <g id="woods" filter="url(#forest)" mask="url(#woods-mask)"><rect width="${W}" height="${H}" fill="${colors.woods}" opacity="${colors.woodsOpacity}"/><rect width="${W}" height="${H}" fill="url(#trees)"/></g>
        <use href="#woods" transform="matrix(-1 0 0 1 ${W} 0)"/>
        <path d="${coastPath(samples,-7,0,0)}" fill="none" stroke="${colors.ink}" stroke-width="1.6" stroke-dasharray="1 6" stroke-linecap="round" opacity=".55"/>
        ${hill(720,270,72,42,184,1,false,colors)}${hill(720,270,72,42,184,1,true,colors)}
        ${hill(390,860,84,46,212,4,false,colors)}${hill(390,860,84,46,212,4,true,colors)}
        ${hill(W/2,820,92,52,247,2.5,false,colors)}
        <g fill="none">${frontLine(blueLand.maxX,1,colors.blueInk)}${frontLine(redLand.minX,-1,colors.redInk)}</g>
        ${territoryLabel((blueLand.minX+blueLand.maxX)/2,'BLUE KINGDOM',colors.blueInk)}
        ${territoryLabel((redLand.minX+redLand.maxX)/2,'RED KINGDOM',colors.redInk)}
        <text x="${W/2}" y="${LABEL_Y-6}" text-anchor="middle" font-size="13" font-style="italic" letter-spacing="3" fill="${colors.ink}" stroke="${colors.paper}" stroke-width="5" stroke-opacity=".9" paint-order="stroke" ${FONT}>No Man&#8217;s Land</text>
        ${compassRose(W/2,H/2-10,68,colors)}
      </g>
      <use href="#coast" fill="none" stroke="${colors.ink}" stroke-width="2.4" stroke-linejoin="round"/>
      <rect ${full} fill="url(#grid)" opacity="${colors.gridOpacity}"/>
    </g>
    ${stains}
    ${grain}
    ${folds}
    ${sheet(sheetRect,colors,style)}
    <rect ${full} fill="url(#vignette)"/>
  `);
}
