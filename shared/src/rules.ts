import type { ArmyFraction, BuildableType, BuildingType, Side, UnitType } from './types.js';

export const GAME_VERSION = '0.4.0';

type Rect={minX:number;maxX:number;minY:number;maxY:number};
const BLUE_LAND:Rect={minX:160,maxX:830,minY:180,maxY:900};
const RED_LAND:Rect={minX:1090,maxX:1760,minY:180,maxY:900};
const BRIDGES:readonly Rect[]=[
  {minX:830,maxX:1090,minY:390,maxY:496},
  {minX:830,maxX:1090,minY:584,maxY:690}
] as const;
/**
 * Padding shrinks each rect on its own, which would open a gap where a bridge meets an island.
 * Walkable bridges therefore reach this far into both islands so their padded rects overlap.
 */
const BRIDGE_ANCHOR=48;
const WALK_AREAS:readonly Rect[]=[
  BLUE_LAND,RED_LAND,
  ...BRIDGES.map(r=>({minX:r.minX-BRIDGE_ANCHOR,maxX:r.maxX+BRIDGE_ANCHOR,minY:r.minY,maxY:r.maxY}))
];

export const GAME_RULES={
  tickMs:50,
  maxMatchMs:20*60_000,
  map:{
    width:1920,height:1080,
    /** Compatibility bounds for camera/navigation. */
    island:{x:160,y:180,width:1600,height:720},
    blueLand:BLUE_LAND,redLand:RED_LAND,bridges:BRIDGES,
    midlineX:960,neutralZone:0
  },
  economy:{startingGold:100,castleIncome:4,villageIncome:5,incomeIntervalMs:5000,maxQueuePerBarracks:5},
  limits:{maxUnitsPerSide:40,maxBuildingsPerSide:30},
  peace:{responseWindowMs:15_000,cooldownMs:30_000}
} as const;

export interface AttackStats{damage:number;range:number;cooldownMs:number}
export interface BuildingStats{label:string;icon:string;cost:number;hp:number;shape:'circle'|'rect';halfWidth:number;halfHeight:number;attack?:AttackStats;description:string}

export const BUILDING_STATS:Record<BuildingType,BuildingStats>={
  castle:{label:'Castle',icon:'🏰',cost:0,hp:1500,shape:'circle',halfWidth:46,halfHeight:46,attack:{damage:9,range:80,cooldownMs:1000},description:'Your seat of power. Fires arrows at nearby attackers. If it falls, you lose.'},
  village:{label:'Village',icon:'🏘️',cost:75,hp:300,shape:'circle',halfWidth:26,halfHeight:26,description:`+${GAME_RULES.economy.villageIncome} gold every ${GAME_RULES.economy.incomeIntervalMs/1000}s.`},
  barracks:{label:'Barracks',icon:'⚔️',cost:120,hp:500,shape:'circle',halfWidth:28,halfHeight:28,description:'Trains troops. More barracks train in parallel.'},
  fence:{label:'Fence',icon:'🪵',cost:30,hp:450,shape:'rect',halfWidth:11,halfHeight:64,description:'Wooden palisade. Enemy troops must go around or break through; yours pass freely.'},
  tower:{label:'Tower',icon:'🗼',cost:130,hp:700,shape:'circle',halfWidth:20,halfHeight:20,attack:{damage:18,range:100,cooldownMs:850},description:'Shoots enemy troops in range. Cannot move.'}
};

export interface UnitStats{label:string;cost:number;trainMs:number;hp:number;radius:number;speed:number;aggroRange:number;attack:AttackStats}
export const UNIT_STATS:Record<UnitType,UnitStats>={
  soldier:{label:'Troop',cost:20,trainMs:2500,hp:100,radius:10,speed:52,aggroRange:120,attack:{damage:12,range:14,cooldownMs:800}}
};

export interface Placement{side:Side;type:BuildingType;x:number;y:number}

/** Blue owns the left island. Red is an exact horizontal mirror on the right island. */
const BLUE_START:{buildings:Omit<Placement,'side'>[];units:{x:number;y:number}[]}={
  buildings:[
    {type:'castle',x:285,y:540},
    {type:'village',x:510,y:330},
    {type:'village',x:500,y:540},
    {type:'village',x:510,y:750},
    {type:'barracks',x:690,y:540}
  ],
  units:[{x:735,y:520},{x:755,y:540},{x:735,y:560}]
};

export function mirrorX(x:number){return GAME_RULES.map.midlineX*2-x}
export function mirrorY(y:number){return y}

export function startingLayout(side:Side){
  const flip=(x:number)=>side==='blue'?x:mirrorX(x);
  return {
    buildings:BLUE_START.buildings.map(b=>({...b,side,x:flip(b.x)})),
    units:BLUE_START.units.map(u=>({x:flip(u.x),y:u.y}))
  };
}

/** Horizontal direction from a side's castle towards the enemy. */
export function forwardDir(side:Side):1|-1{return side==='blue'?1:-1}

export function territoryBounds(side:Side,padX=0,padY=padX){
  const land=side==='blue'?BLUE_LAND:RED_LAND;
  return {minX:land.minX+padX,maxX:land.maxX-padX,minY:land.minY+padY,maxY:land.maxY-padY};
}

const inside=(r:Rect,x:number,y:number,p=0)=>x>=r.minX+p&&x<=r.maxX-p&&y>=r.minY+p&&y<=r.maxY-p;
export function isWalkableLand(x:number,y:number,padding=0){
  return WALK_AREAS.some(r=>inside(r,x,y,padding));
}

/** Parameter range [t0,t1] of segment A→B inside the padded rect, or null. Liang–Barsky clipping. */
function clipSegment(r:Rect,ax:number,ay:number,bx:number,by:number,p:number):[number,number]|null{
  const dx=bx-ax,dy=by-ay;let t0=0,t1=1;
  const checks:[number,number][]=[[-dx,ax-(r.minX+p)],[dx,r.maxX-p-ax],[-dy,ay-(r.minY+p)],[dy,r.maxY-p-ay]];
  for(const[k,q]of checks){
    if(k===0){if(q<0)return null;continue;}
    const t=q/k;
    if(k<0){if(t>t1)return null;if(t>t0)t0=t;}
    else{if(t<t0)return null;if(t<t1)t1=t;}
  }
  return[t0,t1];
}

/** True when the whole segment A→B stays on islands or bridges, i.e. it never crosses the ocean. */
export function segmentOnLand(ax:number,ay:number,bx:number,by:number,padding=0){
  const spans=WALK_AREAS.map(r=>clipSegment(r,ax,ay,bx,by,padding)).filter((s):s is[number,number]=>s!==null).sort((a,b)=>a[0]-b[0]);
  let reach=0;
  for(const[t0,t1]of spans){
    if(t0>reach+1e-6)return false;
    reach=Math.max(reach,t1);
  }
  return spans.length>0&&reach>=1-1e-6;
}

function clampRect(r:Rect,x:number,y:number,p:number){
  return {x:Math.min(r.maxX-p,Math.max(r.minX+p,x)),y:Math.min(r.maxY-p,Math.max(r.minY+p,y))};
}

/** Clamp a destination to the nearest island or bridge surface. */
export function clampToIsland(x:number,y:number,padding=0){
  if(isWalkableLand(x,y,padding))return{x,y};
  let best:{x:number;y:number}|null=null;let bestD=Infinity;
  for(const r of WALK_AREAS){const p=clampRect(r,x,y,padding);const d=(p.x-x)**2+(p.y-y)**2;if(d<bestD){best=p;bestD=d;}}
  return best!;
}

type Located={x:number;y:number;type:BuildingType};
export function distanceToBuilding(building:Located,x:number,y:number){
  const stats=BUILDING_STATS[building.type];
  if(stats.shape==='circle')return Math.max(0,Math.hypot(x-building.x,y-building.y)-stats.halfWidth);
  const dx=Math.max(Math.abs(x-building.x)-stats.halfWidth,0),dy=Math.max(Math.abs(y-building.y)-stats.halfHeight,0);
  return Math.hypot(dx,dy);
}
export function approachPoint(building:Located,x:number,y:number){
  const stats=BUILDING_STATS[building.type];
  if(stats.shape==='circle')return{x:building.x,y:building.y};
  return{x:Math.min(building.x+stats.halfWidth,Math.max(building.x-stats.halfWidth,x)),y:Math.min(building.y+stats.halfHeight,Math.max(building.y-stats.halfHeight,y))};
}

export type PlacementCheck={ok:true}|{ok:false;reason:string};
const BUILDING_GAP=12,EDGE_PADDING=8,FENCE_SNAP_DISTANCE=34;

export function canPlaceBuilding(buildings:readonly(Located&{side?:Side})[],side:Side,type:BuildableType,x:number,y:number):PlacementCheck{
  if(!Number.isFinite(x)||!Number.isFinite(y))return{ok:false,reason:'Invalid position.'};
  const stats=BUILDING_STATS[type],bounds=territoryBounds(side,stats.halfWidth+EDGE_PADDING,stats.halfHeight+EDGE_PADDING);
  if(x<bounds.minX||x>bounds.maxX||y<bounds.minY||y>bounds.maxY)return{ok:false,reason:`You can only build on your own ${side==='blue'?'BLUE':'RED'} island.`};
  for(const other of buildings){
    const os=BUILDING_STATS[other.type],gap=type==='fence'&&other.type==='fence'?0:BUILDING_GAP;
    if(Math.abs(other.x-x)<stats.halfWidth+os.halfWidth+gap&&Math.abs(other.y-y)<stats.halfHeight+os.halfHeight+gap)return{ok:false,reason:'Too close to another building.'};
  }
  return{ok:true};
}

export function snapPlacement(buildings:readonly(Located&{side:Side})[],side:Side,type:BuildableType,x:number,y:number){
  if(type!=='fence')return{x,y};
  // Fences stand vertically, so segments chain end to end along Y.
  const height=BUILDING_STATS.fence.halfHeight*2;let best={x,y},bestDistance=FENCE_SNAP_DISTANCE;
  for(const fence of buildings){
    if(fence.type!=='fence'||fence.side!==side)continue;
    for(const candidate of[{x:fence.x,y:fence.y-height},{x:fence.x,y:fence.y+height}]){
      const d=Math.hypot(candidate.x-x,candidate.y-y);
      if(d<bestDistance&&canPlaceBuilding(buildings,side,'fence',candidate.x,candidate.y).ok){best=candidate;bestDistance=d;}
    }
  }
  return best;
}

export function incomeFor(villages:number){return GAME_RULES.economy.castleIncome+villages*GAME_RULES.economy.villageIncome}
export function fractionOf(fraction:ArmyFraction){return fraction==='all'?1:fraction==='one-third'?1/3:2/3}
