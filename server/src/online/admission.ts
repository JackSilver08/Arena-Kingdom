import { randomUUID } from "node:crypto";
import { ServerError } from "colyseus";
import {
  SNAPSHOT_PROTOCOL_VERSION,
  type CurrentUser,
} from "@arena-kingdom/shared";

export const RESERVATION_SECONDS = 20;
export const rankedAuthority = Object.freeze({});
export interface Admission {
  user: CurrentUser;
  leaseId: string;
  ranked: boolean;
}
interface Lease {
  id: string;
  owner: string;
  timer?: ReturnType<typeof setTimeout>;
}
// The current deployment uses one game process. This registry spans every room and queue.
const leases = new Map<number, Lease>();
const creations = new Map<number, { count: number; expires: number }>();
setInterval(() => {
  for (const [userId, hit] of creations)
    if (hit.expires <= Date.now()) creations.delete(userId);
}, 60_000).unref();
export function limitPrivateCreation(userId: number) {
  const now = Date.now();
  let hit = creations.get(userId);
  if (!hit || hit.expires <= now) {
    hit = { count: 0, expires: now + 60_000 };
    creations.set(userId, hit);
  }
  if (++hit.count > 10)
    throw new ServerError(
      429,
      "Too many private room creations. Wait a minute.",
    );
}
export function requireProtocol(value: unknown) {
  if (value !== SNAPSHOT_PROTOCOL_VERSION) {
    throw new ServerError(
      426,
      `Unsupported game protocol. Reload the game (expected ${SNAPSHOT_PROTOCOL_VERSION}).`,
    );
  }
}
export function claimLease(userId: number, owner: string, ttlMs?: number) {
  if (leases.has(userId))
    throw new ServerError(
      409,
      "You already have an active match or ranked queue.",
    );
  const id = randomUUID();
  const lease: Lease = { id, owner };
  leases.set(userId, lease);
  if (ttlMs)
    lease.timer = setTimeout(() => releaseLease(userId, id), ttlMs).unref();
  return id;
}
export function moveLease(
  userId: number,
  id: string,
  owner: string,
  ttlMs?: number,
) {
  const lease = leases.get(userId);
  if (!lease || lease.id !== id)
    throw new ServerError(
      409,
      "Your online reservation expired. Please try again.",
    );
  clearTimeout(lease.timer);
  lease.owner = owner;
  lease.timer = ttlMs
    ? setTimeout(() => releaseLease(userId, id), ttlMs).unref()
    : undefined;
}
export function ownsLease(userId: number, id: string, owner: string) {
  const lease = leases.get(userId);
  return lease?.id === id && lease.owner === owner;
}
export function releaseLease(userId: number, id: string) {
  const lease = leases.get(userId);
  if (lease?.id !== id) return;
  clearTimeout(lease.timer);
  leases.delete(userId);
}
export function releaseRoomLeases(roomId: string) {
  for (const [userId, lease] of leases)
    if (lease.owner === roomId) releaseLease(userId, lease.id);
}
