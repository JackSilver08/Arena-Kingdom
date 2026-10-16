# P3 — War Council HUD, historical campaign orders and Atlas minimap

P3 builds on the approved hand-inked terrain (P1) and separate building/unit
SVG sprites (P2). **No gameplay or protocol changes.**

## What changed

### Campaign order annotations

- `commandArrows.ts` displays a **dashed ink march line** for MOVE and a
  **thick solid campaign arrow** for ATTACK when Map Style is Atlas.
- Ink/paper border gives contrast on varied relief.
- Atlas orders persist for 3.3 seconds, then fade; old skins retain the
  previous 1.9 second rendering.
- These are *issued command annotations*, not pathfinder-calculated routes.
  Do not depict an arrow threading a mountain as proof of a traversable path.
- Existing pointer listeners produce only the local player's own commands;
  enemies' hidden orders are neither read nor rendered. Switching skins
  does not duplicate listeners and destroy unregisters them.

### Frontline and influence

- `frontlineOverlay.ts`: Atlas uses restrained inked contours, dotted
  faction accents and subdued watercolor influence washes.
- Legacy skins retain previous glow and pulse animation. Atlas removes
  decorative pulsing even if motion is enabled.
- Works on visible `MatchView` only. Recap seek still rebuilds influence
  from the current replay frame, never a later frame.

### Minimap

- `battleMinimap.ts`: 240 x 135 canvas with paper land, pale sea,
  faction territory outline, ink-hatched *existing* impassable mountain
  ridges, square military counters, landmark markers and sepia viewfinder.
- Camera click and arrow-key panning are unchanged; role describes it as
  interactive control.
- The existing fog mask is overlaid **before** plotting view objects.
  Only objects supplied by the current perspective are drawn. No extra
  server or hidden enemy data is accessed. Switching skin is immediate.
- At low resolution, symbols are intentionally limited to a few pixels;
  there are no animated SVG textures every frame.

### HUD

- `campaignHud.css` loads after `battleTheme.css`, scoped to
  `.battle[data-map-style="atlas"]`.
- Historical-paper war-council command board, parchment-colored popup,
  map-frame controls, and lighter minimap. All existing commands, shortcuts,
  focus behavior, controller state and responsive breakpoints remain.
- `GameController.ts` adds a non-interactive War Council kicker to the
  existing command deck. Other styles hide it.
- Map-style selection already sets `data-map-style` via
  `DisplaySettingsPanel.syncControls()`; no new user preference is needed.

## Review artifact

`tools/export-campaign-p3.ts` generates `medieval-campaign-commands.svg`
using the **same palette and order-label vocabulary** as the live renderer.
CI uploads it for graphical design review. This vector legend is not a
runtime screenshot and must not be represented as such.

## Quality and acceptance

- `npm run qa` static, typecheck, tests, production build and bundle cap,
  plus economy balance simulation, must pass.
- `campaignPresentation.test.ts` verifies faction colors are identical across
  minimap and order lines, legacy styles remain compatible, and the proof is
  deterministic/safe SVG.
- Manual runtime gate: desktop and mobile screenshots in Atlas at match start,
  after opening Build, with multiple units selected, while marching/attacking,
  and after switching to MOBA and back. Verify both factions, minimap focus
  click/keyboard, fog and replay. A successful CI run **does not itself approve
  the art direction**.

P3 does not change coastline, ridges, movement, units, AI, network, minimap
camera projection, battle economy, combat math or save data.
