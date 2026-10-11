import test from "node:test";
import assert from "node:assert/strict";
import { TouchCameraGuard } from "../src/game/touchCameraGuard.ts";

test("a plain command tap is released to the command handler", () => {
  const guard = new TouchCameraGuard();
  guard.start(1, false);
  assert.equal(guard.release(1), false);
});

test("starting pinch cancels commands from both fingers including the final release", () => {
  const guard = new TouchCameraGuard();
  guard.start(1, false);
  guard.start(2, false);
  assert.equal(guard.release(2), true);
  assert.equal(guard.release(1), true);
  guard.start(3, false);
  assert.equal(guard.release(3), false);
});

test("camera mode drag can never submit a build or troop command", () => {
  const guard = new TouchCameraGuard();
  guard.start(1, true);
  assert.equal(guard.release(1), true);
});

test("a cancelled touch cannot submit a command and a later independent tap works", () => {
  const guard = new TouchCameraGuard();
  guard.start(1, false);
  guard.cancel();
  assert.equal(guard.release(1), true);
  guard.start(2, false);
  assert.equal(guard.release(2), false);
});
