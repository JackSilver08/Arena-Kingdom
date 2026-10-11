import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer, request as rawRequest } from "node:http";
import { Client, type Room } from "colyseus.js";
import { AVATARS } from "@arena-kingdom/shared";
import { DatabaseSync } from "node:sqlite";

// A separate process and a fresh temporary SQLite path: never opens the real game database.
let processUnderTest: ChildProcess;
let temporary: string;
let endpoint: string;
let log = "";
const rooms: Room[] = [];
const protocolVersion = 6;
const users: { token: string; user: { id: number; rating: number } }[] = [];
async function json(
  route: string,
  method = "GET",
  token?: string,
  body?: unknown,
) {
  const response = await fetch(`${endpoint}${route}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}
const options = (i: number) => ({
  token: users[i].token,
  private: true,
  protocolVersion,
});
const gameClient = () =>
  new Client(endpoint, {
    headers: { "X-Arena-Protocol": String(protocolVersion) },
  });
async function joined(room: Promise<Room>) {
  const value = await room;
  value.onMessage("*", () => undefined);
  rooms.push(value);
  return value;
}
function message<T = any>(
  room: Room,
  type: string,
  timeout = 7000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`No ${type} message. ${log}`)),
      timeout,
    );
    const off = room.onMessage(type, (value) => {
      clearTimeout(timer);
      off();
      resolve(value);
    });
  });
}
async function rank(i: number) {
  return json("/api/ranked", "POST", users[i].token, { protocolVersion });
}
async function paired(a: number, b: number) {
  assert.equal((await rank(a)).status, 200);
  assert.equal((await rank(b)).status, 200);
  const first = (await json("/api/ranked", "GET", users[a].token)).data;
  const second = (await json("/api/ranked", "GET", users[b].token)).data;
  assert.equal(first.status, "matched");
  assert.equal(first.reservation.room.roomId, second.reservation.room.roomId);
  const client = gameClient();
  return [
    await joined(client.consumeSeatReservation(first.reservation)),
    await joined(client.consumeSeatReservation(second.reservation)),
  ];
}
before(async () => {
  temporary = await mkdtemp(path.join(tmpdir(), "arena-online-test-"));
  await writeFile(
    path.join(temporary, "index.html"),
    "<!doctype html><html><body>Test SPA</body></html>",
  );
  await writeFile(path.join(temporary, "test.js"), 'console.log("test");');
  await writeFile(path.join(temporary, "test.css"), "body { color: black }");
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  endpoint = `http://127.0.0.1:${port}`;
  processUnderTest = spawn(
    process.execPath,
    ["--import", "tsx", "src/index.ts"],
    {
      cwd: path.resolve(import.meta.dirname, ".."),
      env: {
        ...process.env,
        PORT: String(port),
        DATABASE_PATH: path.join(temporary, "online.db"),
        CLIENT_DIST: temporary,
        RECONNECT_SECONDS: "2",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  processUnderTest.stdout!.on("data", (data) => {
    log += data;
  });
  processUnderTest.stderr!.on("data", (data) => {
    log += data;
  });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${endpoint}/health`)).ok) break;
    } catch {
      /* startup */
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  for (let i = 0; i < 7; i++) {
    const result = await json("/api/auth/register", "POST", undefined, {
      username: `online_${i}`,
      displayName: `Online ${i}`,
      password: "Long-test-password-42",
      avatar: AVATARS[0],
    });
    assert.equal(result.status, 201, log);
    users.push(result.data);
  }
});
after(async () => {
  await Promise.allSettled(
    rooms.filter((room) => room.connection.isOpen).map((room) => room.leave()),
  );
  if (processUnderTest && processUnderTest.exitCode === null) {
    const exit = new Promise<void>((resolve) =>
      processUnderTest.once("exit", () => resolve()),
    );
    processUnderTest.kill();
    await exit;
  }
  if (temporary) await rm(temporary, { recursive: true, force: true });
});

test('malformed request targets are rejected and the server remains healthy', async () => {
  const status = await new Promise<number>((resolve, reject) => {
    const req = rawRequest(endpoint, { method: 'POST', path: '//[/matchmake' }, (res) => {
      res.resume();
      resolve(res.statusCode!);
    });
    req.on('error', reject);
    req.end('{}');
  });
  assert.equal(status, 400);
  assert.equal((await fetch(`${endpoint}/health`)).status, 200);
});

test("raw public create/joinOrCreate cannot manufacture a rated match", async () => {
  const client = gameClient();
  await assert.rejects(
    joined(client.create("arena", { token: users[0].token, protocolVersion })),
    /ranked|queue/i,
  );
  await assert.rejects(
    joined(
      client.joinOrCreate("arena", { token: users[0].token, protocolVersion }),
    ),
    /ranked|queue/i,
  );
});
test("admission requires authentication and current protocol", async () => {
  const client = gameClient();
  await assert.rejects(
    client.create("arena", { private: true, protocolVersion }),
    /sign in/i,
  );
  await assert.rejects(
    client.create("arena", { ...options(0), protocolVersion: 5 }),
    /protocol/i,
  );
  await assert.rejects(
    client.create("arena", { token: users[0].token, private: true }),
    /protocol/i,
  );
  assert.equal(
    (await json("/api/ranked", "POST", undefined, { protocolVersion })).status,
    401,
  );
  assert.equal(
    (await json("/api/ranked", "POST", users[0].token, { protocolVersion: 5 }))
      .status,
    426,
  );
  const oldReconnect = await json(
    "/matchmake/reconnect/unknown-room",
    "POST",
    undefined,
    { reconnectionToken: "forged", protocolVersion: 5 },
  );
  assert.equal(oldReconnect.data.code, 426);
  const missingReconnect = await json(
    "/matchmake/reconnect/unknown-room",
    "POST",
    undefined,
    { reconnectionToken: "forged" },
  );
  assert.equal(missingReconnect.data.code, 426);
});
test("queue owns one lease, cancellation releases it, tickets cannot be forged", async () => {
  assert.equal((await rank(0)).data.status, "queued");
  assert.equal((await rank(0)).status, 409);
  const client = gameClient();
  await assert.rejects(client.create("arena", options(0)), /already|active/i);
  await assert.rejects(
    client.create("arena", {
      token: users[1].token,
      protocolVersion,
      rankedProof: {},
      ticket: "forged",
    }),
    /ranked|queue/i,
  );
  assert.equal(
    (await json("/api/ranked", "DELETE", users[0].token)).status,
    200,
  );
  const privateRoom = await joined(client.create("arena", options(0)));
  await privateRoom.leave();
});
test("private code joins remain unrated, duplicate rooms rejected, leave-before-start releases", async () => {
  const client = gameClient();
  const blue = await joined(client.create("arena", options(0)));
  await assert.rejects(client.create("arena", options(0)), /already|active/i);
  assert.equal((await rank(0)).status, 409);
  const red = await joined(client.joinById(blue.roomId, options(1)));
  const playing = message(red, "s");
  await playing;
  const ended = message(red, "end");
  blue.send("cmd", { type: "surrender" });
  const result = await ended;
  assert.ok(result.matchId);
  assert.deepEqual(result.ratings, []);
  assert.equal(
    (await json("/api/auth/me", "GET", users[0].token)).data.user.rating,
    1000,
  );
  await blue.leave();
  await red.leave();
  const waiting = await joined(client.create("arena", options(0)));
  await waiting.leave();
  const replacement = await joined(client.create("arena", options(0)));
  await replacement.leave();
});
test("server paired ranked reservations bind seats, reconnect retains lease, Elo persisted once", async () => {
  const [blue, red] = await paired(2, 3);
  const client = gameClient();
  await assert.rejects(
    client.joinById(blue.roomId, options(4)),
    /ranked|queue|locked|full/i,
  );
  await assert.rejects(client.create("arena", options(2)), /already|active/i);
  await message(red, "s");
  const reconnectToken = blue.reconnectionToken;
  blue.connection.close();
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal((await rank(2)).status, 409);
  const rejoined = await joined(client.reconnect(reconnectToken));
  assert.equal(rejoined.roomId, red.roomId);
  const ended = message(red, "end");
  rejoined.send("cmd", { type: "surrender" });
  const result = await ended;
  assert.ok(result.matchId);
  assert.deepEqual(
    result.ratings
      .map((rating: any) => rating.after)
      .sort((a: number, b: number) => a - b),
    [984, 1016],
  );
  assert.equal(
    (await json("/api/auth/me", "GET", users[2].token)).data.user.rating,
    984,
  );
  const match = await json(`/api/matches/${result.matchId}`);
  assert.equal(match.data.rated, true);
  rejoined.send("cmd", { type: "surrender" });
  assert.equal(
    (await json("/api/auth/me", "GET", users[2].token)).data.user.rating,
    984,
  );
  await rejoined.leave();
  await red.leave();
  assert.equal((await rank(2)).status, 200);
  await json("/api/ranked", "DELETE", users[2].token);
});
test("cancelling a matched reservation disposes the pair and releases both users", async () => {
  await rank(4);
  await rank(5);
  assert.equal(
    (await json("/api/ranked", "GET", users[5].token)).data.status,
    "matched",
  );
  await json("/api/ranked", "DELETE", users[4].token);
  assert.equal(
    (await json("/api/ranked", "GET", users[5].token)).data.status,
    "idle",
  );
  const room = await joined(new Client(endpoint).create("arena", options(5)));
  await room.leave();
});
test("ranked queue waits across a large Elo gap instead of pairing arbitrary users", async () => {
  const testDb = new DatabaseSync(path.join(temporary, "online.db"));
  try {
    testDb
      .prepare("UPDATE users SET rating = ? WHERE id = ?")
      .run(2100, users[4].user.id);
    await rank(4);
    await rank(5);
    assert.equal(
      (await json("/api/ranked", "GET", users[4].token)).data.status,
      "queued",
    );
    assert.equal(
      (await json("/api/ranked", "GET", users[5].token)).data.status,
      "queued",
    );
    await json("/api/ranked", "DELETE", users[4].token);
    await json("/api/ranked", "DELETE", users[5].token);
  } finally {
    testDb
      .prepare("UPDATE users SET rating = ? WHERE id = ?")
      .run(1000, users[4].user.id);
    testDb.close();
  }
});
test("simultaneous private creation grants exactly one seat lease", async () => {
  const client = gameClient();
  const results = await Promise.allSettled([
    joined(client.create("arena", options(4))),
    joined(client.create("arena", options(4))),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const admitted = results.find(
    (result) => result.status === "fulfilled",
  ) as PromiseFulfilledResult<Room>;
  await admitted.value.leave();
});
test("countdown disconnect keeps the seat and lobby resumes the same side on reconnect", async () => {
  const client = gameClient();
  const blue = await joined(client.create("arena", options(4)));
  const red = await joined(client.joinById(blue.roomId, options(5)));
  const token = red.reconnectionToken;
  red.connection.close();
  await new Promise((resolve) => setTimeout(resolve, 100));
  await assert.rejects(client.create("arena", options(5)), /already|active/i);
  const rejoined = await joined(client.reconnect(token));
  const lobby = await message(blue, "lobby");
  const returning = lobby.players.find(
    (player: any) => player.userId === users[5].user.id,
  );
  assert.equal(returning.side, "red");
  assert.equal(returning.connected, true);
  assert.equal(lobby.phase, "countdown");
  await rejoined.leave();
  await blue.leave();
});
test("private creation has an account rate cap after ten consented cancellations", async () => {
  const client = gameClient();
  for (let i = 0; i < 10; i++) {
    const room = await joined(client.create("arena", options(6)));
    await room.leave();
  }
  await assert.rejects(client.create("arena", options(6)), /too many|wait/i);
  // The rate rejection must not leave a phantom active lease.
  assert.equal((await rank(6)).status, 200);
  await json("/api/ranked", "DELETE", users[6].token);
});
test("matchmaking collector rejects large fixed/chunked/malformed bodies before room creation", async () => {
  const large = await fetch(`${endpoint}/matchmake/create/arena`, {
    method: "POST",
    body: JSON.stringify({ ...options(4), padding: "x".repeat(33000) }),
  });
  assert.equal(large.status, 413);
  const chunked = await new Promise<number>((resolve, reject) => {
    const req = rawRequest(
      `${endpoint}/matchmake/create/arena`,
      { method: "POST", headers: { "transfer-encoding": "chunked" } },
      (res) => {
        res.resume();
        resolve(res.statusCode!);
      },
    );
    req.on("error", reject);
    req.write("x".repeat(16000));
    req.write("x".repeat(18000));
    req.end();
  });
  assert.equal(chunked, 413);
  const malformed = await fetch(`${endpoint}/matchmake/create/arena`, {
    method: "POST",
    body: "{",
  });
  assert.equal(malformed.status, 400);
});
test('authenticated admission buckets stay independent for players sharing a proxy', async () => {
  let limited = false;
  for (let i = 0; i < 65; i++) {
    const response = await fetch(`${endpoint}/matchmake/create/arena`, {
      method: 'POST',
      headers: { authorization: `Bearer ${users[0].token}`, 'content-type': 'application/json' },
      body: '{}',
    });
    if (response.status === 429) { limited = true; break; }
  }
  assert.equal(limited, true);
  const unrelated = await fetch(`${endpoint}/matchmake/create/arena`, {
    method: 'POST',
    headers: { authorization: `Bearer ${users[1].token}`, 'content-type': 'application/json' },
    body: '{}',
  });
  assert.notEqual(unrelated.status, 429, 'another authenticated account must keep its own allowance');
});

test('ranked polling allowance belongs to the authenticated account behind a shared proxy', async () => {
  let limited = false;
  for (let i = 0; i < 245; i++) {
    const response = await json('/api/ranked', 'GET', users[0].token);
    if (response.status === 429) { limited = true; break; }
  }
  assert.equal(limited, true);
  assert.equal((await json('/api/ranked', 'GET', users[1].token)).status, 200);
});

test("matchmaking collector times out a stalled body and limits request rate", async () => {
  const timeout = await new Promise<number>((resolve, reject) => {
    const req = rawRequest(
      `${endpoint}/matchmake/create/arena`,
      { method: "POST", headers: { "transfer-encoding": "chunked" } },
      (res) => {
        res.resume();
        resolve(res.statusCode!);
        req.destroy();
      },
    );
    req.on("error", reject);
    req.write("{");
  });
  assert.equal(timeout, 408);
  let limited = false;
  for (let i = 0; i < 65; i++) {
    const response = await fetch(`${endpoint}/matchmake/create/arena`, {
      method: "POST",
      body: "{}",
    });
    if (response.status === 429) {
      limited = true;
      break;
    }
  }
  assert.equal(limited, true);
});
test("SPA supports HEAD and assets keep correct MIME or 404", async () => {
  const response = await fetch(`${endpoint}/play`, { method: "HEAD" });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type")!, /text\/html/);
  assert.equal(await response.text(), "");
  assert.match(
    (await fetch(`${endpoint}/test.css`, { method: "HEAD" })).headers.get(
      "content-type",
    )!,
    /text\/css/,
  );
  assert.match(
    (await fetch(`${endpoint}/test.js`, { method: "HEAD" })).headers.get(
      "content-type",
    )!,
    /javascript/,
  );
  assert.equal(
    (await fetch(`${endpoint}/missing.js`, { method: "HEAD" })).status,
    404,
  );
});
