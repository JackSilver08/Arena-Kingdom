import assert from 'node:assert/strict';
import test from 'node:test';
import { MatchEngine, type MatchView } from '@arena-kingdom/shared';

const { BattleRecap, recentReplayEvents } = await import('../src/game/battleRecap');

function recorder() {
  return new BattleRecap(
    { events: { once() {} } } as never,
    {} as HTMLElement,
    { session: { on: () => () => undefined } }
  );
}
function ending(view: MatchView): MatchView {
  return { ...view, timeMs: 1000, result: { winner: 'blue', reason: 'surrender', timeMs: 1000 } };
}

test('recap event readout follows the cursor and never lists future events as recent', () => {
  const view = new MatchEngine().viewForSide('blue');
  const frames: Parameters<typeof recentReplayEvents>[0] = [
    { view, events: [] },
    { view: { ...view, timeMs: 250 }, events: [{ type: 'unitTrained', side: 'blue', x: 500, y: 500 }] },
    { view: { ...view, timeMs: 500 }, events: [{ type: 'matchEnded', result: ending(view).result! }] },
  ];
  assert.deepEqual(recentReplayEvents(frames, 0), []);
  assert.equal(recentReplayEvents(frames, 1)[0].view.timeMs, 250);
  assert.ok(recentReplayEvents(frames, 1).every(frame => frame.view.timeMs <= 250));
});

test('recap freezes at the first final snapshot, preserving opening and ending', () => {
  const recap = recorder();
  const start = new MatchEngine().viewForSide('blue');
  recap.record(start, []);
  const end = ending(start);
  recap.record(end, [{ type: 'matchEnded', result: end.result! }]);
  for (let i = 0; i < 10_000; i++) recap.record(end, []);
  assert.equal(recap.frames().length, 2);
  assert.equal(recap.frames()[0].view.timeMs, 0);
  assert.equal(recap.frames()[1].events[0].type, 'matchEnded');
});

test('combat events do not turn 60fps recording into 60 full snapshots per second', () => {
  const recap = recorder();
  const view = new MatchEngine().viewForSide('blue');
  for (let i = 0; i <= 60; i++) {
    recap.record({ ...view, timeMs: i * (1000 / 60) }, [{ type: 'peaceExpired' }]);
  }
  assert.ok(recap.frames().length <= 5);
  recap.record(ending(view), []);
  assert.equal(recap.frames().flatMap(frame => frame.events).length, 61);
});

test('recorded perspective is independent of later mutable live state', () => {
  const recap = recorder();
  const view = new MatchEngine().viewForSide('blue');
  recap.record(view, []);
  const openingGold = view.players.blue.gold;
  view.players.blue.gold += 500;
  view.units[0].hp = 1;
  assert.equal(recap.frames()[0].view.players.blue.gold, openingGold);
  assert.notEqual(recap.frames()[0].view.units[0].hp, 1);
});
