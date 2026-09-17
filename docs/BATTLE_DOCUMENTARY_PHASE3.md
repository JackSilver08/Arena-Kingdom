# Battle Documentary Phase 3

Phase 3 adds the live battlefield map-style switch requested by the Battle Documentary brief.

## Implemented

- `Documentary` is the default style.
- `Vintage` is a distinct aged-paper variant with warmer sepia tones, stronger stains, grain, folds and vignette.
- `Documentary` keeps the historical campaign-map language but uses a cleaner paper/ink treatment, reduced aging effects and softer grid/terrain treatment.
- Both styles use the same `GAME_RULES.map` dimensions, coastline samples, kingdom boundaries, labels, contour geometry, compass and world coordinates.
- Military symbols are not regenerated or recolored by the style switch. Building and troop textures remain the existing symbol assets.
- Changing style is presentation-only. No simulation, balance, pathfinding or command payload is changed.
- The map renderer listens for display-setting changes and swaps the terrain texture in place after the new SVG texture finishes loading.
- Old map textures are released after the replacement becomes active.

## Verification intent

The settings panel should expose:

`Map style -> Documentary | Vintage`

Switching this control during a battle should change only the map plate. Units, buildings, their coordinates and existing documentary overlays remain in the same world position.
