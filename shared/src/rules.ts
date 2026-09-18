import { coastline, isWalkableLand } from './island.js';
import type { ArmyFraction, BuildableType, BuildingType, Side, UnitType, Vec2 } from './types.js';

export const GAME_VERSION = '0.4.3';

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
  limits:{maxUnitsPerSide:40,maxBuildingsPerSide:30},
  peace:{responseWindowMs:15_000,cooldownMs:30_000},
  fallback:{
<<<<<<< HEAD
    speedMultiplier:1.2,
    speedBuffMs:4000,
    rearguardDamageReduction:0.35,
    safeDistance:260,
    rearguardRatio:0.3
=======
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
>>>>>>> e33f3e2632134d362bf7332c4111399b61dedf74
  }
} as const;

export interface AttackStats{damage:number;range:number;cooldownMs:number}
export interface BuildingStats{label:string;icon:string;cost:number;hp:number;shape:'circle'|'rect';halfWidth:number;halfHeight:number;attack?:AttackStats;description:string}

export const BUILDING_STATS:Record<BuildingType,BuildingStats>={
  castle:{label:'Castle',icon:'🏰',cost:0,hp:1500,shape:'circle',halfWidth:46,halfHeight:46,attack:{damage:9,range:80,cooldownMs:1000},description:'Your seat of power. Fires arrows at nearby attackers. If it falls, you lose.'},
  village:{label:'Village',icon:'🏘️',cost:70,hp:300,shape:'circle',halfWidth:26,halfHeight:26,description:`+${GAME_RULES.economy.villageIncome} gold every ${GAME_RULES.economy.incomeIntervalMs/1000}s. Also expands army supply by ${GAME_RULES.economy.supply.village}.`},
  barracks:{label:'Barracks',icon:'⚔️',cost:110,hp:500,shape:'circle',halfWidth:28,halfHeight:28,description:`Trains troops. More barracks train in parallel and each adds ${GAME_RULES.economy.supply.barracks} army supply.`},
  fence:{label:'Fence',icon:'🪵',cost:25,hp:450,shape:'rect',halfWidth:11,halfHeight:64,description:'Wooden palisade. Enemy troops must go around or break through; yours pass freely.'},
  tower:{label:'Tower',icon:'🗼',cost:120,hp:700,shape:'circle',halfWidth:20,halfHeight:20,attack:{damage:18,range:100,cooldownMs:850},description:`Shoots enemy troops in range. Cannot move. Adds ${GAME_RULES.economy.supply.tower} army supply.`}
};

export interface UnitStats{label:string;cost:number;trainMs:number;hp:number;radius:number;speed:number;aggroRange:number;attack:AttackStats;buildingAttack?:AttackStats}
export const UNIT_STATS:Record<UnitType,UnitStats>={
  soldier:{label:'Soldier',cost:18,trainMs:2200,hp:100,radius:10,speed:52,aggroRange:120,attack:{damage:12,range:14,cooldownMs:800}},
  militia:{label:'Militia',cost:0,trainMs:0,hp:150,radius:10,speed:52,aggroRange:205,attack:{damage:8,range:14,cooldownMs:800}},
  archer:{label:'Archer',cost:21,trainMs:2600,hp:75,radius:10,speed:45,aggroRange:210,attack:{damage:9,range:190,cooldownMs:1100},buildingAttack:{damage:10,range:125,cooldownMs:1250}},
  knight:{label:'Knight',cost:32,trainMs:3200,hp:85,radius:11,speed:150,aggroRange:150,attack:{damage:20,range:18,cooldownMs:1000}}
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

/** Horizontal direction from a side's castle towards the enemy. */
export function forwardDir(side:Side):1|-1{return side==='blue'?1:-1}

/** Bounding box of a kingdom's buildable land, shrunk by the padding. */
export function territoryBounds(side:Side,padX=0,padY=padX){
  const land=side==='blue'?BLUE_LAND:RED_LAND;
  return {minX:land.minX+padX,maxX:land.maxX-padX,minY:land.minY+padY,maxY:land.maxY-padY};
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
/**
 * A fence only needs this much of its length on land. It may run out over the beach, so a chain
 * of snapped fences started anywhere can always be carried on until it seals the far shore.
 */
const FENCE_LAND_GRIP=8;

export function canPlaceBuilding(buildings:readonly(Located&{side?:Side})[],side:Side,type:BuildableType,x:number,y:number):PlacementCheck{
  if(!Number.isFinite(x)||!Number.isFinite(y))return{ok:false,reason:'Invalid position.'};
  const stats=BUILDING_STATS[type],reach=stats.halfWidth+EDGE_PADDING;
  const pastFront=side==='blue'?x+reach>FRONT_LINE.blue:x-reach<FRONT_LINE.red;
  const onLand=type==='fence'
    ?[-1,0,1].some(k=>isWalkableLand(x,y+k*(stats.halfHeight-FENCE_LAND_GRIP)))
    :isWalkableLand(x,y,stats.halfWidth+EDGE_PADDING);
  if(pastFront||!onLand)return{ok:false,reason:`You can only build on your own ${side==='blue'?'BLUE':'RED'} half of the island.`};
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