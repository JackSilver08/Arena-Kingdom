# Battle Documentary — Phase 4: Battle Recap

Phase 4 adds an in-session recap viewer to the battlefield after a match ends.

## Implemented

- Records `MatchView` snapshots at roughly 250 ms intervals, with immediate capture when discrete `GameEvent` values arrive or the match has a result.
- Keeps up to 9,000 frames in memory, providing a bounded client-side recap buffer.
- Adds a `Battle Recap` trigger after the end signal when a usable recording exists.
- Provides a timeline scrubber with event markers.
- Provides Play / Pause and single-frame Step Back / Step Forward controls.
- Provides replay speed controls: 0.25x, 0.5x, 1x and 2x.
- Reconstructs both Blue and Red battlefield state from recorded snapshots.
- Rebuilds the influence/frontline field from the selected replay frame instead of inheriting the final live field.
- Reuses existing combat event effects while seeking, including building-destroyed explosion effects and other recorded combat events.
- Disables live selection/build/troop cursors while replaying.
- Keeps replay rendering separate from the match simulation. Closing the recap restores the normal battlefield renderer.

## Order visibility note

Live command arrows remain player-side only. The current network snapshot protocol does not carry a historical opponent-command stream, so Phase 4 does not invent enemy orders for recap playback. The recap reconstructs the authoritative recorded battlefield states and `GameEvent` stream that are actually available to the client.

A future server-side replay format can add recorded command metadata without changing the recap panel contract.

## Verification target

Manually verify:

1. Complete a match.
2. Open `Battle Recap`.
3. Scrub from the beginning to the end.
4. Play at 0.25x, 0.5x, 1x and 2x.
5. Step backward and forward across an event marker.
6. Confirm Blue/Red units and buildings change to the recorded frame.
7. Confirm the influence/frontline overlay follows the selected frame.
8. Confirm closing recap returns to the post-match battlefield/end state.

Automated `npm run typecheck`, `npm test`, and browser performance verification still need to be run in a local environment with the repository dependencies installed.
