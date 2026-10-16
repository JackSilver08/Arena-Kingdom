import test from 'node:test';
import assert from 'node:assert/strict';
import { ATLAS_SIZE } from '../src/game/atlasEntityArt.ts';
import { counterOutline, pointInsideCounter } from '../src/game/atlasInteraction.ts';

test('all seven visible counter rectangles have accurate click bounds', () => {
  const center = {x:450,y:280};
  for (const type of ['soldier','militia','archer','knight','scout','royal_guard','cannon'] as const) {
    const art=ATLAS_SIZE[type];
    assert.equal(pointInsideCounter(center,center,art),true);
    assert.equal(pointInsideCounter({x:center.x+art.width/2,y:center.y},center,art),true);
    assert.equal(pointInsideCounter({x:center.x-art.width/2,y:center.y},center,art),true);
    assert.equal(pointInsideCounter({x:center.x,y:center.y+art.height/2},center,art),true);
    assert.equal(pointInsideCounter({x:center.x+art.width/2+3,y:center.y},center,art),false);
    assert.equal(pointInsideCounter({x:center.x,y:center.y+art.height/2+3},center,art),false);
    const box=counterOutline(center,art);
    assert.equal(box.width,art.width+7);
    assert.equal(box.height,art.height+7);
    assert.equal(box.x+box.width/2,center.x);
    assert.equal(box.y+box.height/2,center.y);
  }
});
test('counter rectangles are independent from gameplay unit collision radii', () => {
  const c={x:0,y:0};
  const a=ATLAS_SIZE.knight;
  assert.equal(pointInsideCounter({x:23,y:0},c,a),true);
  assert.equal(pointInsideCounter({x:29,y:0},c,a),false);
  assert.deepEqual(counterOutline(c,a,0), {x:-25,y:-16,width:50,height:32});
});
