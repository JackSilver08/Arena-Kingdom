import assert from "node:assert/strict";
import { test } from "node:test";
import {
  claimLease,
  moveLease,
  ownsLease,
  releaseLease,
  releaseRoomLeases,
} from "../src/online/admission.js";

test("reservation expiry releases a user, active/reconnect lease survives old TTL", async () => {
  const expired = claimLease(9001, "reservation", 10);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(ownsLease(9001, expired, "reservation"), false);
  const active = claimLease(9001, "reservation", 10);
  moveLease(9001, active, "active-room");
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(ownsLease(9001, active, "active-room"), true);
  assert.throws(() => claimLease(9001, "other-room"), /active/);
  releaseLease(9001, expired); // An old callback cannot release the newer match.
  assert.equal(ownsLease(9001, active, "active-room"), true);
  releaseRoomLeases("other-room");
  assert.equal(ownsLease(9001, active, "active-room"), true);
  releaseRoomLeases("active-room");
  assert.equal(ownsLease(9001, active, "active-room"), false);
});
