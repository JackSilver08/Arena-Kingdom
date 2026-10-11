import assert from 'node:assert/strict';
import test from 'node:test';
import { joinRanked } from '../src/game/rankedQueue.ts';

test('failed polling cancels an owned queue and preserves the original error', async () => {
  const calls: string[] = [];
  const failure = new Error('Transient polling outage');
  await assert.rejects(joinRanked(async method => {
    calls.push(method);
    if (method === 'GET') throw failure;
    return { status: 'queued' };
  }, async () => ({ leave: async () => undefined }), undefined, 0), error => error === failure);
  assert.deepEqual(calls, ['POST', 'GET', 'DELETE']);
});

test('an initial conflict cannot cancel another already-owned queue', async () => {
  const calls: string[] = [];
  await assert.rejects(joinRanked(async method => {
    calls.push(method);
    throw Object.assign(new Error('Already queued'), { code: 409 });
  }, async () => ({ leave: async () => undefined }), undefined, 0), /Already queued/);
  assert.deepEqual(calls, ['POST']);
});

test('cancelling an in-flight enqueue waits for ownership and then releases it before consuming', async () => {
  const abort = new AbortController();
  const calls: string[] = [];
  await assert.rejects(joinRanked(async (method, signal) => {
    calls.push(method);
    if (method === 'POST') {
      abort.abort();
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      return { status: 'matched', reservation: {} };
    }
    return { status: 'idle' };
  }, async () => { calls.push('consume'); return { leave: async () => undefined }; }, abort.signal), /Cancelled/);
  assert.deepEqual(calls, ['POST', 'DELETE']);
});

test('reservation failure cancels the pair; successful handoff keeps the match', async () => {
  for (const fail of [false, true]) {
    const calls: string[] = [];
    const queue = async (method: string) => {
      calls.push(method);
      return { status: 'matched', reservation: { id: 42 } };
    };
    const consume = async () => {
      if (fail) throw new Error('WebSocket admission failed');
      return { leave: async () => undefined };
    };
    if (fail) await assert.rejects(joinRanked(queue, consume), /admission failed/);
    else await joinRanked(queue, consume);
    assert.deepEqual(calls, fail ? ['POST', 'DELETE'] : ['POST']);
  }
});

test('cancel during reservation admission closes the seat and releases the queue', async () => {
  const abort = new AbortController();
  const calls: string[] = [];
  await assert.rejects(joinRanked(async method => {
    calls.push(method);
    return { status: 'matched', reservation: {} };
  }, async () => {
    abort.abort();
    return { leave: async () => { calls.push('leave'); } };
  }, abort.signal), /Cancelled/);
  assert.deepEqual(calls, ['POST', 'leave', 'DELETE']);
});
