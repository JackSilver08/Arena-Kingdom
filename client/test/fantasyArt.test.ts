import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { BUILDING_STATS, GAME_RULES, MOUNTAIN_RIDGES, UNIT_STATS, isWalkableLand } from '@arena-kingdom/shared';
import { arenaMapArtMoba } from '../src/game/mobaMapArt.ts';
import { arenaMapArtV2 } from '../src/game/mapArt.ts';

test('every terrain skin identifies exactly the authoritative blocked ridges', () => {
  for (const markup of [arenaMapArtMoba(), arenaMapArtV2(GAME_RULES.map, 'documentary'), arenaMapArtV2(GAME_RULES.map, 'vintage')]) {
    assert.equal((markup.match(/data-blocked-ridge=/g) ?? []).length, MOUNTAIN_RIDGES.length);
    MOUNTAIN_RIDGES.forEach((ridge, index) => {
      assert.ok(markup.includes(`data-blocked-ridge="${index}"`));
      assert.ok(markup.includes(`data-footprint="${ridge.cx},${ridge.cy},${ridge.rx},${ridge.ry}"`));
      assert.equal(isWalkableLand(ridge.cx, ridge.cy), false);
    });
  }
});

test('original fantasy art covers every authoritative entity with stable foot anchors', async () => {
  assert.ok(existsSync(new URL('../src/game/fantasyArt.ts', import.meta.url)), 'original fantasy roster missing');
  const { FANTASY_SIZE, fantasyEntityArt } = await import('../src/game/fantasyArt.ts');
  const units = ['soldier', 'militia', 'archer', 'knight', 'scout', 'royal_guard', 'cannon'] as const;
  const buildings = ['castle', 'village', 'barracks', 'tower', 'fence'] as const;
  assert.deepEqual(Object.keys(FANTASY_SIZE).sort(), [...Object.keys(UNIT_STATS), ...Object.keys(BUILDING_STATS)].sort());
  const silhouettes = new Set();
  for (const type of [...units, ...buildings]) {
    const size = FANTASY_SIZE[type];
    assert.ok(size.width > 0 && size.height > 0);
    assert.ok(size.anchorY >= .5 && size.anchorY <= .9);
    for (const side of ['blue', 'red'] as const) {
      const markup = fantasyEntityArt(type, side);
      assert.ok(markup.startsWith('<svg'));
      assert.ok(markup.includes(`data-entity="${type}"`));
      assert.ok(markup.includes(`data-team="${side}"`));
      assert.doesNotMatch(markup, /<image|<script|foreignObject|<text/);
      assert.ok(markup.includes('data-team-accent'));
      assert.equal(markup, fantasyEntityArt(type, side), 'deterministic raster source');
    }
    const neutral = (markup: string) => markup.replace(/#459bd3|#cd5960/g, 'TEAM').replace(/#a2d4e9|#efb1a2/g, 'LIGHT').replace(/data-team="blue"|data-team="red"/g, 'data-team="TEAM"');
    assert.equal(neutral(fantasyEntityArt(type, 'blue')), neutral(fantasyEntityArt(type, 'red')), 'team colours affect accents only');
    silhouettes.add(fantasyEntityArt(type, 'blue'));
  }
  assert.equal(silhouettes.size, 12);
});

test('quality and nature toggles preserve every visible blocked footprint', () => {
  for (const quality of ['low', 'medium', 'high'] as const) {
    for (const nature of [false, true]) {
      const markup = arenaMapArtMoba(GAME_RULES.map, quality, nature);
      assert.equal((markup.match(/data-blocked-ridge=/g) ?? []).length, MOUNTAIN_RIDGES.length);
      assert.equal(markup.includes('data-nature="true"'), nature);
      assert.ok(markup.length < 180000, 'bounded original procedural pack');
      assert.equal(markup, arenaMapArtMoba(GAME_RULES.map, quality, nature));
    }
  }
});

test('terrain raster caps preserve world aspect and bound both dimensions', async () => {
  const { terrainRasterSize, GRAPHICS_TEXTURE_BUDGET } = await import('../src/game/terrainArt.ts');
  for (const quality of ['low', 'medium', 'high'] as const) {
    for (const [w, h] of [[2592, 1080], [1920, 1440], [1920, 1080], [7000, 7000]]) {
      const size = terrainRasterSize(w, h, quality);
      assert.ok(Math.max(size.width, size.height) <= GRAPHICS_TEXTURE_BUDGET[quality].maxEdge);
      assert.ok(Math.abs(size.width / size.height - w / h) < .005);
    }
  }
});

test('fantasy terrain has no baked-in entities, HUD or abstract team labels', () => {
  const markup = arenaMapArtMoba();
  assert.doesNotMatch(markup, /<image|>BLUE<|>RED<|<text|moba-cliff-shadow/);
  assert.ok(markup.includes('data-base-paving="blue"'));
  assert.ok(markup.includes('data-base-paving="red"'));
});

test('the revised map has continuous land without an inland river or lane roads in every preset', () => {
  const oldLane = 'M285 540H865M1055 540H1635';
  for (const quality of ['low', 'medium', 'high'] as const) {
    for (const nature of [false, true]) {
      const markup = arenaMapArtMoba(GAME_RULES.map, quality, nature);
      assert.ok(!/data-shallow-water|id="shallow"|data-road|data-river/.test(markup), 'no inland river or roads');
      assert.ok(!markup.includes(oldLane), 'old connecting roads must not be drawn');
    }
  }
  for (const style of ['documentary', 'vintage'] as const) {
    assert.doesNotMatch(arenaMapArtV2(GAME_RULES.map, style), /data-shallow-water|data-road|data-river/);
  }
});
