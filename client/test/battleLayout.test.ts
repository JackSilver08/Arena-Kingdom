import assert from 'node:assert/strict';
import test from 'node:test';
import { GAME_RULES, startingLayout } from '@arena-kingdom/shared';
import { battleView, terrainView, defaultBattleCamera, battleResolution } from '../src/game/battleLayout.ts';
import { cameraRect } from '../src/game/cameraMath.ts';

test('portrait and desktop stages fill their viewport without shrinking into letterboxes', () => {
  for (const [width, height] of [[360, 800], [390, 844], [1366, 768], [1440, 900]]) {
    const view = battleView(width, height);
    assert.ok(Math.abs(view.width / view.height - width / height) < .002);
    assert.ok(view.width >= GAME_RULES.map.width && view.height >= GAME_RULES.map.height);
  }
});

test('portrait ocean padding does not consume the terrain texture resolution budget', () => {
  const view = terrainView(battleView(360, 800));
  assert.deepEqual(view, { width: 1920, height: 1440 });
});

test('the real drawing buffer stays within dimension and pixel caps through mobile and desktop resize', () => {
  for (const [width, height] of [[360, 800], [390, 844], [1366, 768], [1440, 900], [3840, 2160]]) {
    for (const dpr of [1, 2, 3]) {
      const view = battleView(width, height);
      const resolution = battleResolution({ width, height }, view, dpr);
      const backingWidth = Math.round(view.width * resolution);
      const backingHeight = Math.round(view.height * resolution);
      assert.ok(Math.max(backingWidth, backingHeight) <= 4096);
      assert.ok(backingWidth * backingHeight <= 4_200_000);
      if (width <= 390) assert.ok(backingWidth * backingHeight <= 1_500_000);
    }
  }
});

test('mobile opening camera shows the starting army and gives soldiers readable screen sizes for both sides', () => {
  const stage = { width: 360, height: 800 };
  const view = battleView(stage.width, stage.height);
  for (const side of ['blue', 'red'] as const) {
    const camera = defaultBattleCamera(view, 1, true, side);
    const rect = cameraRect(camera, view, GAME_RULES.map);
    for (const unit of startingLayout(side).units) {
      assert.ok(unit.x >= rect.x && unit.x <= rect.x + rect.width);
      assert.ok(unit.y >= rect.y && unit.y <= rect.y + rect.height);
    }
    assert.ok(32 * camera.zoom * stage.width / view.width >= 15);
  }
  assert.equal(defaultBattleCamera(battleView(1440, 900), 2, false, 'blue').zoom, 2);
});
