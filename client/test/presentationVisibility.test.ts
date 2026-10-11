import test from "node:test";
import assert from "node:assert/strict";
import { MatchEngine, UNIT_STATS, BUILDING_STATS } from "@arena-kingdom/shared";
import {
  visibleSources,
  presentationBudget,
  pointVisible,
} from "../src/game/presentationVisibility.ts";

test("friendly vision sources match alive units/buildings and never read enemy positions", () => {
  const engine = new MatchEngine();
  const view = engine.viewForSide("blue");
  const sources = visibleSources(view, "blue");
  assert.equal(
    sources.length,
    view.units.filter(
      (u) => u.side === "blue" && u.hp > 0 && UNIT_STATS[u.type].vision > 0,
    ).length +
      view.buildings.filter(
        (b) =>
          b.side === "blue" &&
          b.hp > 0 &&
          (BUILDING_STATS[b.type].vision ?? 0) > 0,
      ).length,
  );
  assert.deepEqual(
    visibleSources(
      {
        ...view,
        units: view.units.map((u) => ({ ...u, hp: 0 })),
        buildings: view.buildings.map((b) => ({ ...b, hp: 0 })),
      },
      "blue",
    ),
    [],
  );
});

test("fog matches engine perspective for own territory, neutral strip and enemy points", () => {
  const engine = new MatchEngine();
  for (const side of ["blue", "red"] as const) {
    const view = engine.viewForSide(side);
    const sources = visibleSources(view, side);
    const enemy = side === "blue" ? "red" : "blue";
    const castle = view.buildings.find(
      (b) => b.side === side && b.type === "castle",
    )!;
    assert.equal(pointVisible(castle.x, castle.y, side, sources), true);
    assert.equal(pointVisible(960, 540, side, sources), true);
    assert.equal(
      pointVisible(enemy === "red" ? 1660 : 260, 540, side, []),
      false,
    );
    assert.equal(
      pointVisible(1660, 540, side, [{ x: 1660, y: 540, radius: 80 }]),
      true,
    );
  }
});

test("quality limits decorative work while keeping fog refresh bounded on every preset", () => {
  const low = presentationBudget("low");
  const medium = presentationBudget("medium");
  const high = presentationBudget("high");
  assert.ok(low.effects < medium.effects && medium.effects < high.effects);
  for (const value of [low, medium, high]) {
    assert.ok(value.fogMs >= 80 && value.fogMs <= 200);
    assert.ok(value.natureMs >= 33);
    assert.ok(value.effects <= 90);
  }
});
