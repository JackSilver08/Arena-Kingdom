import test from "node:test";
import assert from "node:assert/strict";
import {
  clampCamera,
  screenToWorld,
  worldToScreen,
  zoomAt,
  minimapPoint,
  cameraRect,
} from "../src/game/cameraMath.ts";

const world = { width: 1920, height: 1080 };
const viewport = { width: 960, height: 540 };
const camera = { x: 960, y: 540, zoom: 1 };
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-8, `${a} ≠ ${b}`);

test("inverse transform keeps selection and building commands on the same world point after pan and zoom", () => {
  for (const zoom of [0.5, 1, 1.8, 3]) {
    const state = { x: 760, y: 610, zoom };
    const point = { x: 1040, y: 690 };
    const roundtrip = screenToWorld(
      worldToScreen(point, state, viewport),
      state,
      viewport,
    );
    near(roundtrip.x, point.x);
    near(roundtrip.y, point.y);
  }
});

test("clamps panning to the visible half extents instead of losing the map at an edge", () => {
  assert.deepEqual(
    clampCamera({ x: -200, y: 9999, zoom: 2 }, viewport, world),
    { x: 240, y: 945, zoom: 2 },
  );
});

test("centres oversized viewports at zoom-out and rejects nonfinite coordinates", () => {
  assert.deepEqual(
    clampCamera({ x: Number.NaN, y: Infinity, zoom: 0.25 }, viewport, world),
    { x: 960, y: 540, zoom: 0.25 },
  );
});

test("wheel zoom anchors the world point underneath the cursor", () => {
  const pointer = { x: 660, y: 390 };
  const before = screenToWorld(pointer, camera, viewport);
  const next = zoomAt(camera, 1.5, pointer, viewport, world, {
    min: 0.5,
    max: 3,
  });
  const after = screenToWorld(pointer, next, viewport);
  near(after.x, before.x);
  near(after.y, before.y);
});

test("zoom bounds and camera reset stay finite even for invalid factors", () => {
  assert.equal(
    zoomAt(camera, 100, { x: 480, y: 270 }, viewport, world, {
      min: 0.5,
      max: 3,
    }).zoom,
    3,
  );
  assert.deepEqual(
    zoomAt(camera, NaN, { x: 480, y: 270 }, viewport, world, {
      min: 0.5,
      max: 3,
    }),
    camera,
  );
});

test("minimap clicks map independently of canvas CSS size and clamp outside taps", () => {
  assert.deepEqual(
    minimapPoint({ x: 96, y: 54 }, { width: 192, height: 108 }, world),
    { x: 960, y: 540 },
  );
  assert.deepEqual(
    minimapPoint({ x: -5, y: 150 }, { width: 192, height: 108 }, world),
    { x: 0, y: 1080 },
  );
});

test("minimap view rectangle clips oversized viewport to map and follows zoom", () => {
  assert.deepEqual(
    cameraRect({ x: 960, y: 540, zoom: 0.25 }, viewport, world),
    { x: 0, y: 0, width: 1920, height: 1080 },
  );
  assert.deepEqual(cameraRect({ x: 600, y: 400, zoom: 2 }, viewport, world), {
    x: 360,
    y: 265,
    width: 480,
    height: 270,
  });
});
