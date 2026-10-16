# P2 — Hand-engraved buildings and tactical army counters

## Art target

The reference is a 2D illustrated history-book campaign map, **not** fantasy
character sprites, isometric buildings, or generic modern app icons.

This phase revises the `Medieval Tactical Atlas` presentation without changing
any simulation rules or the accepted P0/P1 map geometry.

### Building architecture

All five building assets use common parchment material, warm stone, terracotta
roof accents and dark-brown engraved ink, with limited faction pennants.

| Entity | Silhouette and visual cues |
| --- | --- |
| Castle | Large fortified gatehouse, two perimeter towers, central keep and banners |
| Village | Three small vernacular cottages, garden marks, fence and minor pennant |
| Barracks | Military longhall, palisade yard, crossed training weapons and standard |
| Tower | A narrow tall crenellated lookout, arched windows and a single banner |
| Fence | Repeated wooden stakes and horizontal bindings; all pre-existing rotations |

Artwork source is `client/src/game/atlasEntityArt.ts`. These are actual separate
live sprites. There are no buildings permanently baked into the landscape.

### Counter vocabulary

Seven unit types each use a **small horizontal rectangular map counter** with
an ink emblem, double frame and faction trim:

- Soldier — crossed swords
- Militia — spear and shield
- Archer — bow and arrow
- Knight — mounted-knight/horse silhouette
- Scout — reconnaissance eye
- Royal Guard — crown emblem
- Cannon — cannon barrel and wheel

Each displayed counter still maps to one engine unit ID; do not merge or change
HP, damage, formation, AI, pathfinding, Fog of War, or network messages.
The selected-unit gold highlight and pointer hit testing use the visible
counter bounds; physical collision radius remains authoritative in shared/.

The texture roster is loaded once per faction by the existing renderer.
The `fantasy`, `vintage`, and `documentary` map styles are untouched and
remain selectable. Atlas counters do not bob, recoil, or tilt like character
sprites; combat feedback still uses existing HP indicators and attack effects.

## Review artifact and QA

`tools/export-campaign-entities.ts` renders a **proof sheet from the same
function used to build Phaser SVG textures**. The CI run uploads
`medieval-campaign-entities.svg` for user art review.

Automated QA must pass:
- Static integration checks, typecheck, client/shared/server tests, build, bundle.
- Exactly 5 building silhouettes and 7 distinct hand-inked counter glyphs.
- Deterministic ASCII-only artwork on both sides, with faction-colored accents
  but identical neutral architecture.
- Texture sizes and anchor constraints; rectangular counter hitbox tests.
- Existing economic balance simulation.

**Visual acceptance remains separate from CI:** open the actual SVG proof sheet
and compare it against the reference, then manually run a battle at close/far
zoom, switch skins in combat, build structures, recruit from Barracks, select
overlapping counters, place and rotate fences, use Fog of War and replay.
Review both desktop and mobile screenshots before marking P2 art approved.

Next: P3 addresses HUD/minimap and historical campaign command arrows.
