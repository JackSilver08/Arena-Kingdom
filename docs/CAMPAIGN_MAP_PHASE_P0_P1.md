# Phase P0 + P1 — Hand-drawn campaign map terrain

## Art-direction freeze

**Primary reference:** textbook / historical campaign maps, rendered as a 2D
pen-and-ink medieval atlas. This phase corrects the former parchment-skin problem:
large-scale landscape, forest cartography, mountains, territory washes, shore
engraving and plate typography have their own visual language.

The user-approved battlefield shape remains the source of truth.

Palette lives in `client/src/game/atlasStyle.ts`. Keep low-contrast paper and
terrain under high-contrast army counters. The new plate has stable
`data-campaign-plate="2"` metadata to identify this generation of the atlas.

## Assets and integration

- `atlasMapArt.ts` assembles the authoritative shoreline, light land/sea
  colors, pale territory tint, 2D labels, compass, and outer frame.
- `campaignEngraving.ts` draws deterministic ink groves, hatch marks and
  watercolor-shaped relief washes. There are no artificial roads or rivers.
- `atlasRidgeEngraving.ts` renders detailed sketch mountain peaks *clipped
  to each of the five existing, authoritative impassable footprints*. This
  changes no collision geometry.
- `terrainArt.ts` uses that mountain rendering **only in Atlas**; all
  original map skins retain their existing mountain assets.
- `fogOfWar.ts` uses sepia ink for unknown territory on Atlas, but its
  visibility, explored-territory mask and hidden entity filtering do not change.
- `BattleScene.ts` suppresses animated surf overlay on Atlas because wave
  hatching is built into the printed plate; old styles keep existing surf.
- `tools/export-campaign-plate.ts` exports the actual SVG supplied to Phaser.
  CI uploads `medieval-campaign-map.svg` as a downloadable 30-day artifact.

## Invariants

- No change to the 1920x1080 coordinate system, coastline algorithm,
  collision rules, buildable regions, units, AI, network state, or game balance.
- Map art does not bake in units, buildings, fake attack arrows, path hints,
  or enemy locations.
- All cosmetic variation is deterministic and bounded across Low/Medium/High.
- Fog behavior remains authoritative; the sepia color is only presentation.

## QA and review gates

Automated: static checks, typecheck, unit tests, server tests, production build,
bundle cap, and balance simulation. Atlas-specific tests verify the exact
shoreline, all five ridge footprints, deterministic output, map size and quality
budgets, stroke-based nature density, no baked-in entities or false paths.

**Manual visual review still required**: download the SVG from CI artifacts,
open at 1920x1080, and compare to the historical-campaign reference. Then
locally verify a real Phaser battle with FoW, the Display skin selector, camera
zoom, and settings persistence. This phase is not accepted solely because CI
passed.

P2 (buildings/counters) and P3 (HUD/minimap/commands) are separate subsequent
milestones.
