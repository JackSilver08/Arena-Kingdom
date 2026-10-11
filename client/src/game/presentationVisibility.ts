import {
  BUILDING_STATS,
  UNIT_STATS,
  isInNeutralZone,
  isPointInTerritory,
  type MatchView,
  type Side,
} from "@arena-kingdom/shared";

export interface VisionSource {
  x: number;
  y: number;
  radius: number;
}
export type PresentationQuality = "low" | "medium" | "high";

/** Reconstruct only public, friendly vision sources. Never consult an unfiltered state. */
export function visibleSources(view: MatchView, side: Side): VisionSource[] {
  const sources: VisionSource[] = [];
  for (const building of view.buildings) {
    const radius = BUILDING_STATS[building.type].vision ?? 0;
    if (building.side === side && building.hp > 0 && radius > 0)
      sources.push({ x: building.x, y: building.y, radius });
  }
  for (const unit of view.units) {
    const radius = UNIT_STATS[unit.type].vision;
    if (unit.side === side && unit.hp > 0 && radius > 0)
      sources.push({ x: unit.x, y: unit.y, radius });
  }
  return sources;
}

export function pointVisible(
  x: number,
  y: number,
  side: Side,
  sources: readonly VisionSource[],
) {
  return (
    isPointInTerritory(side, x, y) ||
    isInNeutralZone(x, y) ||
    sources.some(
      (source) => Math.hypot(source.x - x, source.y - y) <= source.radius,
    )
  );
}

export function presentationBudget(quality: PresentationQuality) {
  return quality === "low"
    ? { effects: 24, fogMs: 160, natureMs: 100, weatherMs: 100, fogScale: 0.25 }
    : quality === "medium"
      ? { effects: 48, fogMs: 120, natureMs: 50, weatherMs: 50, fogScale: 0.25 }
      : {
          effects: 90,
          fogMs: 80,
          natureMs: 34,
          weatherMs: 34,
          fogScale: 0.375,
        };
}
