import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('ranked countdown disposal preserves the complete advertised reconnect window', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'arena-countdown-test-'));
  process.env.DATABASE_PATH = path.join(temporary, 'isolated.db');
  process.env.RECONNECT_SECONDS = '30';
  const { ArenaRoom } = await import('../src/rooms/ArenaRoom.js');
  const { db } = await import('../src/db/database.js');
  try {
    const room = new ArenaRoom();
    let disposalDelay = 0;
    room.clock.setTimeout = ((_callback: unknown, delay: number) => {
      disposalDelay = delay;
      return { clear() {} };
    }) as typeof room.clock.setTimeout;
    room.unlock = async () => undefined;
    (room as unknown as { cancelCountdown(): void }).cancelCountdown();
    assert.ok(disposalDelay > 30_000, 'room must survive all 30 seconds of reconnection grace');
  } finally {
    db.close();
    await rm(temporary, { recursive: true, force: true });
  }
});
