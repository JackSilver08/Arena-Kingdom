# Phase 2: Command Arrows

Arena Kingdom now has a lightweight battlefield command-arrow layer.

## Live battle

Only the local player's orders are visualized. This preserves the fog-of-war principle from the Battle Documentary brief: an opponent's live intentions are not exposed to the player.

Arrows appear for:

- `T` troop-mode orders
- right-click move orders
- right-click attack orders

They are curved quadratic-bezier paths with:

- pale paper halo
- dark ink outline
- side-colored core
- clear arrowhead
- start marker
- moving marker unless reduced motion is enabled
- short lifetime and a maximum of eight recent arrows

## Depth

Command arrows use `BATTLE_DEPTH.arrows`, below entity symbols but above the ground layer, so buildings and troop symbols remain readable.

## Replay readiness

The renderer keeps `recordedOrder` semantics separate from input capture so Battle Recap can later reveal both sides without changing the live battle visibility rule.
