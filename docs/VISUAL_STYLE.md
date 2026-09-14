# Arena Kingdom visual direction

## Style

Arena Kingdom uses a lightweight **stylized 2D fantasy cartography** direction: flat illustrated forms, a restrained palette, clear silhouettes and soft 2D depth. The target is a fantasy diorama rather than a 3D world or a children's emoji board.

## Rendering principles

- Keep the battlefield 2D and browser-first.
- Use layered terrain: water, island shadow, coast, grass, paths, props, structures, units and effects.
- Use one consistent upper-left light source and subtle lower-right shadows.
- Keep team identity in banners, flags and restrained sapphire/crimson accents rather than coloring the whole terrain blue or red.
- Favor custom SVG/vector-style sprites for battlefield entities. Emoji remain useful as UI language and as fallback presentation.
- Preserve a clear visual hierarchy: Castle > production/defense > army > scenery.
- Prefer reusable compact textures and generated SVGs so the web client stays small.

## Visual architecture

`client/src/game/art.ts` contains the original vector artwork and illustrated arena texture. `client/src/game/visuals.ts` is the presentation boundary used by `BattleScene`, so gameplay logic can remain independent of whether a visual is an SVG sprite or a future raster asset.

The map art keeps the existing 1920×1080 logical world coordinates. This means terrain can become richer without changing movement, hit testing, building placement or future pathfinding coordinates.

## Asset strategy

For the production phase, keep the same interfaces and replace or augment generated SVGs with hand-authored WebP/PNG atlases only where that gives a measurable visual benefit. Avoid large textures, unnecessary animation sheets and heavyweight 3D assets.
