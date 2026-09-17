# Battle Documentary - Phase 1

## Dynamic influence and frontline overlay

The battlefield now has a presentation-only influence field shared by the client and future recap renderer.

- 40px sampling grid over the map bounding box.
- Sources: troop 1, village 2, tower 3, barracks 3, castle 6, fence 0.5.
- Exponential distance falloff with sigma 90px.
- Small static left/right bias keeps the opening contour centred.
- Influence is refreshed every 333ms and smoothed with a 1500ms exponential response.
- Zero contour is extracted with marching squares and smoothed with two Chaikin passes.
- Closed contour pockets are retained as influence polygons.
- Client overlay uses low-alpha team tinting and a layered frontline stroke.
- Overlay can be disabled from Display Settings; reduced-motion removes the pulse.
- No enemy orders or targets are exposed by this layer.

The influence system does not alter movement, combat, economy, placement, or match results.
