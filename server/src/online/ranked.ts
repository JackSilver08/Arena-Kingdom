import { Router } from "express";
import { matchMaker } from "colyseus";
import {
  SNAPSHOT_PROTOCOL_VERSION,
  type CurrentUser,
} from "@arena-kingdom/shared";
import { auth, rateLimit, requireAuth } from "../http/middleware.js";
import {
  claimLease,
  moveLease,
  rankedAuthority,
  releaseLease,
  requireProtocol,
  RESERVATION_SECONDS,
  type Admission,
} from "./admission.js";

const QUEUE_TTL_MS = 60_000;
interface Entry {
  user: CurrentUser;
  leaseId: string;
  joinedAt: number;
  seenAt: number;
  status: "queued" | "matching" | "matched";
  reservation?: Awaited<ReturnType<typeof matchMaker.reserveSeatFor>>;
}
const entries = new Map<number, Entry>();
let matching: Promise<void> | null = null;
// Start near rating parity, widening by 50 Elo every ten seconds up to 600 Elo.
export function ratingWindow(waitMs: number) {
  return Math.min(600, 100 + Math.floor(Math.max(0, waitMs) / 10_000) * 50);
}
async function pairQueue() {
  const now = Date.now();
  for (const [id, entry] of entries) {
    if (now - entry.seenAt > QUEUE_TTL_MS) {
      entries.delete(id);
      if (entry.status === "queued") releaseLease(id, entry.leaseId);
    }
  }
  const waiting = [...entries.values()]
    .filter((entry) => entry.status === "queued")
    .sort((a, b) => a.joinedAt - b.joinedAt);
  for (const a of waiting) {
    if (a.status !== "queued") continue;
    const b = waiting
      .filter(
        (entry) =>
          entry !== a &&
          entry.status === "queued" &&
          Math.abs(entry.user.rating - a.user.rating) <=
            Math.max(
              ratingWindow(now - a.joinedAt),
              ratingWindow(now - entry.joinedAt),
            ),
      )
      .sort(
        (x, y) =>
          Math.abs(x.user.rating - a.user.rating) -
          Math.abs(y.user.rating - a.user.rating),
      )[0];
    if (!b) continue;
    a.status = b.status = "matching";
    let roomId: string | undefined;
    try {
      const room = await matchMaker.createRoom("arena", {
        rankedProof: rankedAuthority,
        protocolVersion: SNAPSHOT_PROTOCOL_VERSION,
      });
      roomId = room.roomId;
      for (const entry of [a, b]) {
        moveLease(
          entry.user.id,
          entry.leaseId,
          roomId,
          RESERVATION_SECONDS * 1000,
        );
        const admission: Admission = {
          user: entry.user,
          leaseId: entry.leaseId,
          ranked: true,
        };
        entry.reservation = await matchMaker.reserveSeatFor(
          room,
          { protocolVersion: SNAPSHOT_PROTOCOL_VERSION },
          admission,
        );
      }
      a.status = b.status = "matched";
      a.seenAt = b.seenAt = Date.now();
    } catch (error) {
      for (const entry of [a, b]) {
        entries.delete(entry.user.id);
        releaseLease(entry.user.id, entry.leaseId);
      }
      if (roomId) await matchMaker.getLocalRoomById(roomId)?.disconnect();
      console.error("[ranked] reservation failed", error);
    }
  }
}
function pump() {
  if (!matching)
    matching = pairQueue().finally(() => {
      matching = null;
    });
  return matching;
}
setInterval(() => {
  void pump();
}, 1000).unref();

export function forgetRankedEntry(userId: number, leaseId: string) {
  if (entries.get(userId)?.leaseId === leaseId) entries.delete(userId);
}
export function forgetRankedRoom(roomId: string) {
  for (const [userId, entry] of entries)
    if (entry.reservation?.room.roomId === roomId) entries.delete(userId);
}
export function rankedRouter() {
  const router = Router();
  router.use(
    rateLimit({
      windowMs: 60_000,
      max: 1200,
      message: "Too many ranked queue requests. Wait a minute.",
    }),
  );
  router.use(requireAuth);
  router.use(rateLimit({
    windowMs: 60_000,
    max: 240,
    message: 'Too many ranked queue requests. Wait a minute.',
    key: (_req, res) => `user:${auth(res).user.id}`,
  }));
  router.post("/", async (req, res, next) => {
    try {
      requireProtocol(req.body?.protocolVersion);
      const user = auth(res).user;
      const leaseId = claimLease(user.id, "queue");
      entries.set(user.id, {
        user,
        leaseId,
        joinedAt: Date.now(),
        seenAt: Date.now(),
        status: "queued",
      });
      await pump();
      const entry = entries.get(user.id);
      if (!entry)
        throw new Error("Match reservation failed. Please try again.");
      res.json({ status: entry.status, reservation: entry.reservation });
    } catch (error) {
      next(error);
    }
  });
  router.get("/", async (_req, res) => {
    const entry = entries.get(auth(res).user.id);
    if (!entry) {
      res.json({ status: "idle" });
      return;
    }
    entry.seenAt = Date.now();
    await pump();
    res.json({ status: entry.status, reservation: entry.reservation });
  });
  router.delete("/", async (_req, res) => {
    const userId = auth(res).user.id;
    // Serialize cancellation with reservation creation so a cancelled entry cannot become a hidden match.
    if (matching) await matching;
    const entry = entries.get(userId);
    if (entry) {
      entries.delete(userId);
      releaseLease(userId, entry.leaseId);
      if (entry.reservation)
        await matchMaker
          .getLocalRoomById(entry.reservation.room.roomId)
          ?.disconnect();
    }
    res.json({ status: "idle" });
  });
  return router;
}
