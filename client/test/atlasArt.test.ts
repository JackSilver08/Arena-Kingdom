import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILDING_STATS, GAME_RULES, MOUNTAIN_RIDGES, UNIT_STATS, coastline, isWalkableLand } from '@arena-kingdom/shared';
import { arenaMapArtAtlas } from '../src/game/atlasMapArt.ts';
import { ATLAS_MAP_VERSION, ATLAS_COLORS } from '../src/game/atlasStyle.ts';
import { ATLAS_SIZE, atlasEntityArt } from '../src/game/atlasEntityArt.ts';

test('tactical atlas uses authoritative shoreline, mountain footprints and terrain dimensions', () => {
  const art = arenaMapArtAtlas();
  const start = coastline(480)[0];
  assert.ok(art.includes('data-map-style="atlas"'));
  assert.equal(ATLAS_MAP_VERSION, 2);
  assert.ok(art.includes('data-campaign-plate="2"'));
  assert.ok(art.includes('data-cartography="watercolor-relief"'));
  assert.ok(art.includes('data-cartography="terrain-ink"'));
  assert.ok(art.includes('data-engraving="mountain"'));
  assert.ok(art.includes('data-grove="ink"'));
  assert.ok(art.includes(ATLAS_COLORS.ink));
  assert.ok(art.includes(ATLAS_COLORS.sea));
  assert.ok(art.includes('viewBox="0 0 1920 1080"'));
  assert.ok(art.includes('id="atlas-coast" d="M' + start.x.toFixed(1) + ' ' + start.y.toFixed(1)));
  assert.equal((art.match(/data-blocked-ridge=/g) ?? []).length, MOUNTAIN_RIDGES.length);
  for (const r of MOUNTAIN_RIDGES) {
    assert.ok(art.includes('data-footprint="' + [r.cx, r.cy, r.rx, r.ry].join(',') + '"'));
    assert.equal(isWalkableLand(r.cx, r.cy), false);
  }
  assert.ok(art.includes('data-cartography="compass"'));
  assert.ok(art.includes('data-cartography="woods"'));
  assert.ok(art.includes('data-cartography="frame"'));
  assert.doesNotMatch(art, /<image|data-entity=|data-shallow-water|data-road|data-river/);
});
test('inked forest and terrain layers respect reduced detail without moving obstacles', () => {
  const sparse = arenaMapArtAtlas(GAME_RULES.map, 'low', false);
  const detailed = arenaMapArtAtlas(GAME_RULES.map, 'high', true);
  assert.equal((sparse.match(/data-grove="ink"/g) ?? []).length, 16);
  assert.equal((detailed.match(/data-grove="ink"/g) ?? []).length, 16);
  assert.ok(detailed.match(/stroke-linejoin="round"/g)!.length >
    sparse.match(/stroke-linejoin="round"/g)!.length);
  assert.equal((sparse.match(/data-blocked-ridge=/g) ?? []).length, 5);
  assert.equal((detailed.match(/data-blocked-ridge=/g) ?? []).length, 5);
  assert.doesNotMatch(detailed, /data-road|data-river|data-route|data-unit|data-building/);
});

test('atlas terrain obeys presentation quality and viewport settings', () => {
  const large = { width: 2400, height: 1400 };
  for (const quality of ['low', 'medium', 'high'] as const) {
    for (const nature of [false, true]) {
      const art = arenaMapArtAtlas(large, quality, nature);
      assert.ok(art.includes('viewBox="-240 -160 2400 1400"'));
      assert.ok(art.length < 200000, 'compact procedural map');
      assert.equal(art, arenaMapArtAtlas(large, quality, nature));
      assert.equal((art.match(/data-blocked-ridge=/g) ?? []).length, MOUNTAIN_RIDGES.length);
    }
  }
});
test('all seven military counters and five medieval building glyphs are original vector art', () => {
  const roster = [...Object.keys(UNIT_STATS), ...Object.keys(BUILDING_STATS)].sort();
  assert.deepEqual(Object.keys(ATLAS_SIZE).sort(), roster);
  const signatures = new Set<string>();
  for (const type of roster as Array<keyof typeof ATLAS_SIZE>) {
    const dim = ATLAS_SIZE[type];
    assert.ok(dim.width >= 24 && dim.height >= 24);
    assert.ok(dim.anchorY >= .5 && dim.anchorY <= .9);
    for (const side of ['blue', 'red'] as const) {
      const svg = atlasEntityArt(type, side);
      assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
      assert.ok(svg.includes('data-entity="' + type + '"'));
      assert.ok(svg.includes('data-team="' + side + '"'));
      assert.ok(svg.includes('data-team-accent'));
      assert.doesNotMatch(svg, /<script|<image|<foreignObject|<text|undefined/);
      assert.equal(svg, atlasEntityArt(type, side));
    }
    assert.notEqual(atlasEntityArt(type,'blue'), atlasEntityArt(type,'red'));
    signatures.add(atlasEntityArt(type, 'blue'));
  }
  assert.equal(signatures.size, roster.length, 'all silhouettes differ');
});
