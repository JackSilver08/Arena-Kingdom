import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BUILDING_STATS,
  MatchEngine,
  NavGrid,
  canPlaceBuilding,
  decodeSnapshot,
  encodeSnapshot,
  fenceAngle,
  parseCommand,
  snapPlacement
} from '../src/index.js';

function near(a:number,b:number,e=1e-9){return Math.abs(a-b)<=e;}

test('fence rotations map 0..7 to eight 45 degree headings',()=>{
  for(let r=0;r<8;r++)assert.ok(near(fenceAngle(r),r*Math.PI/4));
  assert.equal(fenceAngle(8),0);
  assert.equal(fenceAngle(-1),7*Math.PI/4);
});

test('all eight fence rotations can be placed on clear land',()=>{
  for(let r=0;r<8;r++)assert.equal(canPlaceBuilding([],'blue','fence',600,480,r).ok,true);
});

test('rotated fence collision uses OBBs and endpoint joins remain legal',()=>{
  const first={side:'blue' as const,type:'fence' as const,x:600,y:480,rotation:0};
  assert.equal(canPlaceBuilding([first],'blue','fence',600,480,4).ok,false);
  const horizontal=snapPlacement([first],'blue','fence',650,544,2);
  assert.deepEqual(horizontal,{x:664,y:544});
  assert.equal(canPlaceBuilding([first],'blue','fence',horizontal.x,horizontal.y,2).ok,true);
  const diagonal=snapPlacement([first],'blue','fence',641,519,1);
  assert.ok(Math.hypot(diagonal.x-641,diagonal.y-519)<34);
  assert.equal(canPlaceBuilding([first],'blue','fence',diagonal.x,diagonal.y,1).ok,true);
});

test('parseCommand validates fence rotation',()=>{
  assert.deepEqual(
    parseCommand({type:'build',building:'fence',x:600,y:480,rotation:7}),
    {type:'build',building:'fence',x:600,y:480,rotation:7}
  );
  assert.equal(parseCommand({type:'build',building:'fence',x:600,y:480,rotation:8}),null);
  assert.equal(parseCommand({type:'build',building:'fence',x:600,y:480,rotation:1.5}),null);
});

test('NavGrid blocks enemies but not owners for horizontal and diagonal fences',()=>{
  for(const rotation of [1,2] as const){
    const nav=new NavGrid();
    nav.rebuild([{id:900+rotation,side:'blue',type:'fence',x:600,y:480,rotation,hp:BUILDING_STATS.fence.hp}]);
    assert.ok(nav.firstWall('red',600,400,600,560));
    assert.equal(nav.firstWall('blue',600,400,600,560),null);
  }
});

test('snapshot wire format round-trips fence rotation without growing the payload',()=>{
  const engine=new MatchEngine();
  engine.state.players.blue.gold=10_000;
  assert.equal(engine.command('blue',{type:'build',building:'fence',x:600,y:540,rotation:3}).ok,true);
  const encoded=encodeSnapshot(engine.state,[]);
  assert.equal(encoded.b.length%9,0);
  const fence=decodeSnapshot(JSON.parse(JSON.stringify(encoded))).view.buildings.find(b=>b.type==='fence'&&b.side==='blue');
  assert.ok(fence);
  assert.equal(fence.rotation,3);
});
