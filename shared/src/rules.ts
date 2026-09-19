import { coastline, isWalkableLand } from './island.js';
import type { ArmyFraction, BuildableType, BuildingType, Side, UnitType, Vec2 } from './types.js';

export const GAME_VERSION = '0.7.0';

type Rect={minX:number;maxX:number;minY:number;maxY:number};
/** Each kingdom builds on its side of its front line; the strip between them is no man's land. */
const FRONT_LINE:Record<Side,number>={blue:830,red:1090};

/** Sutherland-Hodgman clip of a closed polygon to one side of a vertical line. */
function clipToSide(points:readonly Vec2[],x:number,keepLeft:boolean){
  const inside=(p:Vec2)=>keepLeft?p.x<=x:p.x>=x;
  const cross=(a:Vec2,b:Vec2)=>({x,y:a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x)});
  const out:Vec2[]=[];
  points.forEach((p,i)=>{
    const prev=points[(i+points.length-1)%points.length];
    if(inside(p)){if(!inside(prev))out.push(cross(prev,p));out.push(p);}
    else if(inside(prev))out.push(cross(prev,p));
  });
  return out;
}
const boundsOf=(points:readonly Vec2[]):Rect=>({
  minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),
  minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))
});
const COAST=coastline();
const TERRITORY:Record<Side,readonly Vec2[]>={blue:clipToSide(COAST,FRONT_LINE.blue,true),red:clipToSide(COAST,FRONT_LINE.red,false)};
const ISLAND=boundsOf(COAST);
const BLUE_LAND=boundsOf(TERRITORY.blue);
const RED_LAND=boundsOf(TERRITORY.red);

export const GAME_RULES={
  tickMs:50,
  maxMatchMs:20*60_000,
  map:{
    width:1920,height:1080,
    /** Bounding box of the island, for camera/navigation. The coastline itself lives in island.ts. */
    island:{x:ISLAND.minX,y:ISLAND.minY,width:ISLAND.maxX-ISLAND.minX,height:ISLAND.maxY-ISLAND.minY},
    blueLand:BLUE_LAND,redLand:RED_LAND,
    midlineX:960,
    /** Width of the unbuildable strip between the two kingdoms. */
    neutralZone:RED_LAND.minX-BLUE_LAND.maxX
  },
  economy:{
    /** Tuned for faster match tempo: more opening liquidity and faster infrastructure payback. */
    startingGold:110,
    castleIncome:5,
    villageIncome:6,
    incomeIntervalMs:5000,
    maxQueuePerBarracks:5,
    /** Soft army capacity: the kingdom can exceed it, but the excess consumes gold. */
    supply:{castle:6,barracks:3,village:1,tower:2,upkeepPerUnit:1}
  },
  militia:{
    /** Local village defenders are a three-person reserve, not part of the regular army. */
    count:3,
    /** Enemy units entering this edge-distance from a Village can trigger a local response. */
    triggerRange:150,
    /** Once deployed, militia continue responding until the threat leaves this larger bubble. */
    leashRange:205,
    /** Regular soldiers inside this bubble are the village's local response force. */
    localDefenderRange:150,
    /** Militia deploy when local regular defenders are fewer than the nearby attackers. */
    localDefenderRatio:1,
    /** Collision keeps units outside the Village footprint, so this is the practical return point. */
    returnDistance:42,
    spawnDistance:42,
    /** 1.5x the regular soldier's HP and 1/1.5x its damage. */
    hpMultiplier:1.5,
    damageMultiplier:2/3
  },
  royalGuard:{
    roster:7,
    hp:250,
    damage:24,
    speed:150,
    radius:11,
    attackRange:18,
    attackCooldownMs:800,
    vision:180,
    activationRange:180,
    emergencyRange:160,
    mediumThreat:18,
    highThreat:32,
    emergencyThreat:42,
    emergencyHoldMs:10_000,
    returnDistance:70,
    threatWeight:{soldier:10,archer:9,knight:16,militia:7,scout:3,royal_guard:18}
  },
  limits:{maxUnitsPerSide:40,maxBuildingsPerSide:30},
  peace:{responseWindowMs:15_000,cooldownMs:30_000},
  fallback:{
    /** 20% movement boost for the first 4 seconds of a tactical fall back. */
    speedMultiplier:1.2,
    speedBuffMs:4_000,
    /** Rearguard takes 35% less damage while holding the line. */
    rearguardDamageReduction:0.35,
    /** Once the chasing enemy is this far away, the rearguard can roll back. */
    safeDistance:260,
    /** Tactical scan used to pick the nearest threat for the interception point. */
    detectionRange:260,
    /** Rearguard should be roughly 30% of the group, never above 35% when that constraint is possible. */
    rearguardRatio:0.30,
    /** Minimum regular troops required before a fall back can split into roles. */
    minimumSplitSize:2
  }
} as const;

export interface AttackStats{damage:number;range:number;cooldownMs:number}
export interface BuildingStats{label:string;icon:string;cost:number;hp:number;shape:'circle'|'rect';halfWidth:number;halfHeight:number;attack?:AttackStats;vision?:number;description:string}

export const BUILDING_STATS:Record<BuildingType,BuildingStats>={
  castle:{label:'Castle',icon:'🏰',cost:0,hp:1500,shape:'circle',halfWidth:46,halfHeight:46,attack:{damage:9,range:80,cooldownMs:1000},vision:400,description:'Your seat of power. Fires arrows at nearby attackers. If it falls, you lose.'},
  village:{label:'Village',icon:'🏘️',cost:70,hp:300,shape:'circle',halfWidth:26,halfHeight:26,vision:160,description:`+${GAME_RULES.economy.villageIncome} gold every ${GAME_RULES.economy.incomeIntervalMs/1000}s. Also expands army supply by ${GAME_RULES.economy.supply.village}.`},
  barracks:{label:'Barracks',icon:'⚔️',cost:110,hp:500,shape:'circle',halfWidth:28,halfHeight:28,vision:140,description:`Trains troops. More barracks train in parallel and each adds ${GAME_RULES.economy.supply.barracks} army supply.`},
  fence:{label:'Fence',icon:'🪵',cost:25,hp:450,shape:'rect',halfWidth:11,halfHeight:64,vision:0,description:'Wooden palisade. Enemy troops must go around or break through; yours pass freely.'},
  tower:{label:'Tower',icon:'🗼',cost:120,hp:700,shape:'circle',halfWidth:20,halfHeight:20,attack:{damage:18,range:100,cooldownMs:850},vision:320,description:`Shoots enemy troops in range. Cannot move. Adds ${GAME_RULES.economy.supply.tower} army supply.`}
};

export interface UnitStats{
  label:string;
  cost:number;
  trainMs:number;
  hp:number;
  radius:number;
  speed:number;
  aggroRange:number;
  attack:AttackStats;
  buildingAttack?:AttackStats;
  vision:number;
  splashRadius?:number;
}
export const UNIT_STATS:Record<UnitType,UnitStats>={
  soldier:{label:'Soldier',cost:18,trainMs:2200,hp:100,radius:10,speed:52,aggroRange:120,attack:{damage:12,range:14,cooldownMs:800},vision:150},
  militia:{label:'Militia',cost:0,trainMs:0,hp:150,radius:10,speed:52,aggroRange:205,attack:{damage:8,range:14,cooldownMs:800},vision:180},
  archer:{label:'Archer',cost:21,trainMs:2600,hp:75,radius:10,speed:45,aggroRange:210,attack:{damage:9,range:190,cooldownMs:1100},buildingAttack:{damage:10,range:125,cooldownMs:1250},vision:190},
  knight:{label:'Knight',cost:32,trainMs:3200,hp:85,radius:11,speed:150,aggroRange:150,attack:{damage:20,range:18,cooldownMs:1000},vision:170},
  scout:{label:'Scout',cost:10,trainMs:1800,hp:40,radius:9,speed:100,aggroRange:0,attack:{damage:0,range:0,cooldownMs:999999},vision:300},
  royal_guard:{label:'Royal Guard',cost:0,trainMs:0,hp:GAME_RULES.royalGuard.hp,radius:GAME_RULES.royalGuard.radius,speed:GAME_RULES.royalGuard.speed,aggroRange:520,attack:{damage:GAME_RULES.royalGuard.damage,range:GAME_RULES.royalGuard.attackRange,cooldownMs:GAME_RULES.royalGuard.attackCooldownMs},vision:GAME_RULES.royalGuard.vision},
  cannon:{label:'Cannon',cost:100,trainMs:8000,hp:180,radius:15,speed:25,aggroRange:360,attack:{damage:80,range:360,cooldownMs:3500},buildingAttack:{damage:120,range:360,cooldownMs:3500},vision:220,splashRadius:42}
};

export interface Placement{side:Side;type:BuildingType;x:number;y:number}

/** Blue owns the left half of the island. Red is an exact horizontal mirror on the right half. */
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

/** A kingdom's buildable land: the island on its side of the front line. */
export function territoryOutline(side:Side):readonly Vec2[]{return TERRITORY[side]}

export function isPointInTerritory(side:Side,x:number,y:number){
  const polygon=TERRITORY[side];
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    const intersect=((a.y>y)!==(b.y>y)) && x < ((b.x-a.x)*(y-a.y))/(b.y-a.y)+a.x;
    if(intersect) inside=!inside;
  }
  return inside;
}

export function isInNeutralZone(x:number,y:number){
  return x>=BLUE_LAND.maxX && x<=RED_LAND.minX && isWalkableLand(x,y);
}

/** Horizontal direction from a side's castle towards the enemy. */
export function forwardDir(side:Side):1|-1{return side==='blue'?1:-1}

/** Bounding box of a kingdom's buildable land, shrunk by the padding. */
export function territoryBounds(side:Side,padX=0,padY=padX){
  const land=side==='blue'?BLUE_LAND:RED_LAND;
  return {minX:land.minX+padX,maxX:land.maxX-padX,minY:land.minY+padY,maxY:land.maxY-padY};
}

type Located={x:number;y:number;type:BuildingType;rotation?:number};
export function normalizeFenceRotation(rotation?: number) {
  if (!Number.isInteger(rotation)) return 0;
  return ((rotation as number) % 8 + 8) % 8;
}
export function fenceAngle(rotation?: number) { return normalizeFenceRotation(rotation) * Math.PI / 4; }
function rotateToLocal(dx:number,dy:number,angle:number) { const cos=Math.cos(angle),sin=Math.sin(angle); return {x:dx*cos+dy*sin,y:-dx*sin+dy*cos}; }
function rotateFromLocal(x:number,y:number,angle:number) { const cos=Math.cos(angle),sin=Math.sin(angle); return {x:x*cos-y*sin,y:x*sin+y*cos}; }
function fenceLongAxis(rotation?:number) { const angle=fenceAngle(rotation); return {x:-Math.sin(angle),y:Math.cos(angle)}; }
function fenceHalfExtents(rotation?:number) { const angle=fenceAngle(rotation),cos=Math.abs(Math.cos(angle)),sin=Math.abs(Math.sin(angle)); const {halfWidth:hw,halfHeight:hh}=BUILDING_STATS.fence; return {x:cos*hw+sin*hh,y:sin*hw+cos*hh}; }
function fenceCorners(building:Located,rotationOverride?:number) {
  const angle=fenceAngle(rotationOverride ?? building.rotation ?? 0),{halfWidth:hw,halfHeight:hh}=BUILDING_STATS.fence;
  return ([[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]] as const).map(([x,y])=>{const p=rotateFromLocal(x,y,angle);return{x:building.x+p.x,y:building.y+p.y};});
}
function fenceEndpoints(building:Located,rotationOverride?:number) {
  const axis=fenceLongAxis(rotationOverride ?? building.rotation),half=BUILDING_STATS.fence.halfHeight;
  return [{x:building.x-axis.x*half,y:building.y-axis.y*half},{x:building.x+axis.x*half,y:building.y+axis.y*half}];
}
function projectionRange(points:readonly Vec2[],axis:Vec2) { let min=Infinity,max=-Infinity; for(const p of points){const v=p.x*axis.x+p.y*axis.y;min=Math.min(min,v);max=Math.max(max,v);} return {min,max}; }
function polygonsOverlapSAT(a:readonly Vec2[],b:readonly Vec2[]) {
  const axes:Vec2[]=[]; for(const points of [a,b]) for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length],ex=q.x-p.x,ey=q.y-p.y,len=Math.hypot(ex,ey)||1;axes.push({x:-ey/len,y:ex/len});}
  for(const axis of axes){const pa=projectionRange(a,axis),pb=projectionRange(b,axis);if(pa.max<pb.min||pb.max<pa.min)return false;} return true;
}
function circleVsFenceOverlap(circle:{x:number;y:number;radius:number},fence:Located) {
  const local=rotateToLocal(circle.x-fence.x,circle.y-fence.y,fenceAngle(fence.rotation)),{halfWidth:hw,halfHeight:hh}=BUILDING_STATS.fence;
  return Math.hypot(Math.max(Math.abs(local.x)-hw,0),Math.max(Math.abs(local.y)-hh,0)) < circle.radius + BUILDING_GAP;
}
function fencesMayJoin(a:Located,b:Located) {
  const centerDistance = Math.hypot(a.x - b.x, a.y - b.y);
  if (centerDistance <= 4) return false;
  return fenceEndpoints(a).some(pa => fenceEndpoints(b).some(pb => Math.hypot(pa.x - pb.x, pa.y - pb.y) <= 2.5));
}
export function distanceToBuilding(building:Located,x:number,y:number){
  const stats=BUILDING_STATS[building.type]; if(stats.shape==='circle')return Math.max(0,Math.hypot(x-building.x,y-building.y)-stats.halfWidth);
  const local=rotateToLocal(x-building.x,y-building.y,fenceAngle(building.rotation));
  return Math.hypot(Math.max(Math.abs(local.x)-stats.halfWidth,0),Math.max(Math.abs(local.y)-stats.halfHeight,0));
}
export function approachPoint(building:Located,x:number,y:number){
  const stats=BUILDING_STATS[building.type]; if(stats.shape==='circle')return{x:building.x,y:building.y};
  const angle=fenceAngle(building.rotation),local=rotateToLocal(x-building.x,y-building.y,angle);
  const clamped={x:Math.min(stats.halfWidth,Math.max(-stats.halfWidth,local.x)),y:Math.min(stats.halfHeight,Math.max(-stats.halfHeight,local.y))};
  const world=rotateFromLocal(clamped.x,clamped.y,angle); return{x:building.x+world.x,y:building.y+world.y};
}
export type PlacementCheck={ok:true}|{ok:false;reason:string};
const BUILDING_GAP=12,EDGE_PADDING=8,FENCE_SNAP_DISTANCE=34,FENCE_LAND_GRIP=8;
export function canPlaceBuilding(buildings:readonly(Located&{side?:Side})[],side:Side,type:BuildableType,x:number,y:number,rawRotation?:number):PlacementCheck{
  if(!Number.isFinite(x)||!Number.isFinite(y))return{ok:false,reason:'Invalid position.'};
  const rotation=type==='fence'?normalizeFenceRotation(rawRotation):0,stats=BUILDING_STATS[type];
  const extent=type==='fence'?fenceHalfExtents(rotation):{x:stats.halfWidth,y:stats.halfHeight};
  const pastFront=side==='blue'?x+extent.x+EDGE_PADDING>FRONT_LINE.blue:x-extent.x-EDGE_PADDING<FRONT_LINE.red;
  const onLand=type==='fence'?(()=>{const axis=fenceLongAxis(rotation),grip=Math.max(0,stats.halfHeight-FENCE_LAND_GRIP);return[-1,0,1].some(k=>isWalkableLand(x+axis.x*k*grip,y+axis.y*k*grip));})():isWalkableLand(x,y,Math.max(extent.x,extent.y)+EDGE_PADDING);
  if(pastFront||!onLand)return{ok:false,reason:`You can only build on your own ${side==='blue'?'BLUE':'RED'} half of the island.`};
  const candidate:Located={x,y,type,rotation};
  for(const other of buildings){
    const os=BUILDING_STATS[other.type];
    if(type==='fence'&&other.type==='fence'){if(fencesMayJoin(candidate,other))continue;if(polygonsOverlapSAT(fenceCorners(candidate),fenceCorners(other)))return{ok:false,reason:'Too close to another building.'};continue;}
    if(type==='fence'&&os.shape==='circle'){
      if(circleVsFenceOverlap({x:other.x,y:other.y,radius:os.halfWidth+BUILDING_GAP},candidate))return{ok:false,reason:'Too close to another building.'};
      continue;
    }
    if(stats.shape==='circle'&&other.type==='fence'){
      if(circleVsFenceOverlap({x,y,radius:stats.halfWidth+BUILDING_GAP},other))return{ok:false,reason:'Too close to another building.'};
      continue;
    }
    if(Math.abs(other.x-x)<stats.halfWidth+os.halfWidth+BUILDING_GAP&&Math.abs(other.y-y)<stats.halfHeight+os.halfHeight+BUILDING_GAP)
      return{ok:false,reason:'Too close to another building.'};
  } return{ok:true};
}
export function snapPlacement(buildings:readonly(Located&{side:Side})[],side:Side,type:BuildableType,x:number,y:number,rawRotation?:number){
  if(type!=='fence')return{x,y}; const rotation=normalizeFenceRotation(rawRotation),axis=fenceLongAxis(rotation);
  let best={x,y},bestDistance=FENCE_SNAP_DISTANCE;
  for(const fence of buildings){if(fence.type!=='fence'||fence.side!==side)continue;for(const anchor of fenceEndpoints(fence))for(const sign of [-1,1] as const){
    const center={x:anchor.x-axis.x*BUILDING_STATS.fence.halfHeight*sign,y:anchor.y-axis.y*BUILDING_STATS.fence.halfHeight*sign},d=Math.hypot(center.x-x,center.y-y);
    if(d>=bestDistance||!canPlaceBuilding(buildings,side,'fence',center.x,center.y,rotation).ok)continue; best=center;bestDistance=d;
  }} return best;
}
export function incomeFor(villages:number){return GAME_RULES.economy.castleIncome+villages*GAME_RULES.economy.villageIncome}

export function armySupplyCapacity(buildings:readonly Located[]){
  let capacity=0;
  for(const building of buildings){
    if(building.type==='castle') capacity+=GAME_RULES.economy.supply.castle;
    else if(building.type==='barracks') capacity+=GAME_RULES.economy.supply.barracks;
    else if(building.type==='village') capacity+=GAME_RULES.economy.supply.village;
    else if(building.type==='tower') capacity+=GAME_RULES.economy.supply.tower;
  }
  return capacity;
}

/** Gold paid every income interval for the army above the kingdom's supply capacity. */
export function armyUpkeep(armySize:number,supplyCapacity:number){
  const overCapacity=Math.max(0,Math.floor(armySize)-Math.floor(supplyCapacity));
  return Math.ceil(overCapacity*GAME_RULES.economy.supply.upkeepPerUnit);
}

export function fractionOf(fraction:ArmyFraction){return fraction==='all'?1:fraction==='one-third'?1/3:2/3}