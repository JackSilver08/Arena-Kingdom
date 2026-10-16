# Medieval Tactical Atlas - implementation guide

Medieval Tactical Atlas is the new default map presentation for Arena Kingdom. It uses the approved rounded island outline, parchment and watercolor terrain, ink-engraved forests and coast, illustrated medieval buildings and military counters. This is an interactive Phaser presentation, not a screenshot baked into a background texture.

## Layer separation

- atlasMapArt.ts draws the static coastline, paper, forests, compass, frame, territory washes and the five authoritative mountain collision ridges. Coastline points come from the shared coastline function; the buildable border comes from GAME_RULES.map. No fake mountains, roads or rivers are added.
- atlasEntityArt.ts draws five building types (Castle, Village, Barracks, Tower, Fence) and seven rectangular military counters. Both teams share shapes; cloth, flags and counter outlines encode ownership.
- visuals.ts loads and caches textures once and allows switching map styles. Legacy Fantasy MOBA, Documentary and Vintage remain available.
- BattleScene.ts swaps live entity textures and sizes when settings change. Unit IDs, world coordinates, hit detection, building placement, health, visibility, replay and the network protocol are preserved.

## Gameplay invariants

- Terrain movement and building permissions remain owned by shared/.
- No changes to 1920x1080 world geometry, simulation, AI or multiplayer.
- The new terrain does not convey hidden opponent information.
- No army stacking or merging is simulated. Each counter corresponds to a real individual selectable unit. Zoom-level grouping is separate future work.
- Asset loading retains the raster fallback and quality limits.
- The frame and compass are ornamentation only.

## QA

Run npm run qa. Atlas tests check terrain geometry, roster, deterministic output, quality presets and absence of baked-in units. Also manually verify fresh and saved profiles, style switching, zoom, placement and fence rotation, barracks recruitment, fog, mobile controls and replay before a broad release.
