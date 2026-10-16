import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN_INK, campaignKeySvg, campaignMinimapPalette, campaignOverlayTheme, campaignSideColor, campaignSideColorNumber } from '../src/game/campaignPresentation.ts';
import { ATLAS_COLORS } from '../src/game/atlasStyle.ts';

test('P3 atlas uses consistent faction color between counters, HUD, arrows and minimap', () => {
  assert.equal(campaignSideColor('blue'), ATLAS_COLORS.blue);
  assert.equal(campaignSideColor('red'), ATLAS_COLORS.red);
  assert.equal(campaignSideColorNumber('blue'), parseInt(ATLAS_COLORS.blue.slice(1), 16));
  assert.equal(campaignSideColorNumber('red'), parseInt(ATLAS_COLORS.red.slice(1), 16));
  const mini = campaignMinimapPalette('atlas');
  assert.equal(mini.blue, CAMPAIGN_INK.blue);
  assert.equal(mini.red, CAMPAIGN_INK.red);
  assert.equal(mini.sea, CAMPAIGN_INK.ocean);
  assert.equal(mini.land, CAMPAIGN_INK.paper);
  assert.notEqual(mini.ink, mini.land);
  assert.equal(campaignOverlayTheme('atlas').atlas, true);
  assert.equal(campaignOverlayTheme('atlas').ink, parseInt(ATLAS_COLORS.ink.slice(1), 16));
});
test('P3 legacy styles retain existing minimap and arrow semantics', () => {
  for (const style of ['moba','documentary','vintage'] as const) {
    assert.deepEqual(campaignMinimapPalette(style), campaignMinimapPalette('moba'));
    assert.equal(campaignOverlayTheme(style).atlas, false);
  }
});
test('P3 legend is generated from live palette and documents orders not routes', () => {
  const svg = campaignKeySvg();
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
  assert.match(svg, /Advance \/ MOVE/);
  assert.match(svg, /Attack \/ ASSAULT/);
  assert.match(svg, /Front line \/ INFLUENCE/);
  assert.match(svg, /not pathfinder routes/);
  for (const color of [ATLAS_COLORS.blue,ATLAS_COLORS.red,ATLAS_COLORS.ink]) {
    assert.ok(svg.includes(color));
  }
  assert.equal(svg, campaignKeySvg());
  assert.ok(svg.length < 10000);
  assert.doesNotMatch(svg, /<script|<foreignObject|<image/);
});
