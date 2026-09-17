/**
 * Scripted strategy lab for the kingdom economy pass.
 * Usage: npm run simulate:balance -- [repeats]
 *
 * Each pair is run in both colours so map-side bias is visible in the output.
 * The lab reports factual simulation metrics only. It does not change game rules.
 */
import {
  BUILDING_STATS,
  GAME_RULES,
  MatchEngine,
  armySupplyCapacity,
  armyUpkeep,
  canPlaceBuilding,
  forwardDir,
  type BuildableType,
  type FormationType,
  type Side,
} from '../src/index.js';

const STRATEGIES = ['rush', 'economy', 'defensive', 'balanced'] as const;
type Strategy = (typeof STRATEGIES)[number];

interface StrategyProfile {
  attackAtMs: number;
  attackArmy: number;
  formation: FormationType;
  targets: Partial<Record<BuildableType, number>>;
  buildOrder: BuildableType[];
  reserveGold: number;
  defendFraction: number;
}

const PROFILES: Record<Strategy, StrategyProfile> = {
  rush: {
    attackAtMs: 45_000,
    attackArmy: 12,
    formation: 'wedge',
    targets: { barracks: 2, village: 1 },
    buildOrder: ['barracks', 'barracks', 'village'],
    reserveGold: 0,
    defendFraction: 0.85,
  },
  economy: {
    attackAtMs: 90_000,
    attackArmy: 12,
    formation: 'line',
    targets: { village: 6, barracks: 2, tower: 1 },
    buildOrder: ['village', 'village', 'village', 'barracks', 'barracks', 'tower'],
    reserveGold: 50,
    defendFraction: 0.7,
  },
  defensive: {
    attackAtMs: 110_000,
    attackArmy: 12,
    formation: 'square',
    targets: { village: 4, barracks: 1, tower: 2, fence: 4 },
    buildOrder: ['village', 'tower', 'village', 'fence', 'fence', 'fence', 'fence', 'barracks', 'tower'],
    reserveGold: 40,
    defendFraction: 1,
  },
  balanced: {
    attackAtMs: 80_000,
    attackArmy: 10,
    formation: 'line',
    targets: { village: 5, barracks: 2, tower: 1, fence: 2 },
    buildOrder: ['village', 'barracks', 'village', 'barracks', 'village', 'tower', 'fence', 'fence'],
    reserveGold: 30,
    defendFraction: 0.7,
  },
};

interface MatchMetrics {
  strategy: Strategy;
  side: Side;
  result: Side | 'draw';
  reason: string;
  timeMs: number;
  peakArmy: number;
  peakSupply: number;
  peakUpkeep: number;
  finalGold: number;
  villages: number;
  barracks: number;
  towers: number;
  fences: number;
  firstAttackMs: number | null;
  firstOverSupplyMs: number | null;
}

function placeBuilding(engine: MatchEngine, side: Side, type: BuildableType): boolean {
  const castle = engine.castleOf(side);
  if (!castle) return false;
  const dir = forwardDir(side);
  const land = side === 'blue' ? GAME_RULES.map.blueLand : GAME_RULES.map.redLand;
  const stats = BUILDING_STATS[type];
  const candidates: { x: number; y: number }[] = [];
  const ys = [-360, -240, -120, 0, 120, 240, 360];
  const xs = [70, 130, 190, 250, 310, 370];

  for (const distance of xs) {
    for (const y of ys) candidates.push({ x: castle.x + dir * distance, y: castle.y + y });
  }
  if (type === 'tower' || type === 'fence') {
    const frontX = dir > 0 ? land.maxX - stats.halfWidth - 12 : land.minX + stats.halfWidth + 12;
    for (const y of ys) candidates.unshift({ x: frontX, y: castle.y + y });
  }

  for (const candidate of candidates) {
    if (!canPlaceBuilding(engine.state.buildings, side, type, candidate.x, candidate.y).ok) continue;
    if (engine.command(side, { type: 'build', building: type, x: candidate.x, y: candidate.y }).ok) return true;
  }
  return false;
}

class StrategyController {
  private elapsedMs = 0;
  private attackTimer = 0;
  private firstAttackMs: number | null = null;
  private firstOverSupplyMs: number | null = null;
  private nextBuildIndex = 0;
  private underPressure = false;
  private defenseTimer = 0;

  constructor(readonly side: Side, readonly profile: StrategyProfile) {}

  update(engine: MatchEngine, deltaMs: number) {
    if (engine.ended) return;
    this.elapsedMs += deltaMs;
    this.attackTimer -= deltaMs;
    this.defenseTimer -= deltaMs;

    this.tryBuildNext(engine);
    this.respondToIncursion(engine);

    const army = engine.armyOf(this.side).length;
    const supply = armySupplyCapacity(engine.buildingsOf(this.side));
    if (army > supply && this.firstOverSupplyMs === null) this.firstOverSupplyMs = this.elapsedMs;

    const projectCost = this.nextProjectCost(engine);
    const reserve = Math.max(this.profile.reserveGold, projectCost);
    if (engine.state.players[this.side].gold >= 20 + reserve) {
      for (const barracks of engine.buildingsOf(this.side, 'barracks')) {
        if (barracks.queue >= 2) continue;
        if (engine.armyOf(this.side).length + barracks.queue >= GAME_RULES.limits.maxUnitsPerSide) break;
        if (!engine.command(this.side, { type: 'train', barracksId: barracks.id, count: 1 }).ok) break;
      }
    }

    if (
      !this.underPressure &&
      this.elapsedMs >= this.profile.attackAtMs &&
      army >= this.profile.attackArmy &&
      this.attackTimer <= 0
    ) {
      const target = this.attackTarget(engine);
      if (target) {
        const ids = engine.armyOf(this.side).map((u) => u.id);
        const result = engine.command(this.side, {
          type: 'move',
          unitIds: ids,
          x: target.x,
          y: target.y,
          attack: true,
          targetId: target.id,
          formation: this.profile.formation,
        });
        if (result.ok && this.firstAttackMs === null) this.firstAttackMs = this.elapsedMs;
        this.attackTimer = 15_000;
      }
    }
  }

  get metrics() {
    return { firstAttackMs: this.firstAttackMs, firstOverSupplyMs: this.firstOverSupplyMs };
  }

  private respondToIncursion(engine: MatchEngine) {
    if (this.defenseTimer > 0) return;
    const enemy: Side = this.side === 'blue' ? 'red' : 'blue';
    const castle = engine.castleOf(this.side);
    const buildings = engine.buildingsOf(this.side).filter((b) => b.type !== 'fence');
    const intruders = engine.armyOf(enemy).filter(
      (u) =>
        forwardDir(this.side) * (u.x - GAME_RULES.map.midlineX) < 0 &&
        (buildings.some((b) => Math.hypot(b.x - u.x, b.y - u.y) <= 180) ||
          (castle ? Math.hypot(castle.x - u.x, castle.y - u.y) <= 260 : false))
    );

    if (!intruders.length) {
      this.underPressure = false;
      return;
    }

    this.underPressure = true;
    const cx = intruders.reduce((sum, u) => sum + u.x, 0) / intruders.length;
    const cy = intruders.reduce((sum, u) => sum + u.y, 0) / intruders.length;
    const defenders = engine
      .armyOf(this.side)
      .slice()
      .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    const count = Math.min(defenders.length, Math.max(1, Math.ceil(defenders.length * this.profile.defendFraction)));
    const ids = defenders.slice(0, count).map((u) => u.id);
    if (ids.length) {
      engine.command(this.side, { type: 'move', unitIds: ids, x: cx, y: cy, attack: true, formation: this.profile.formation });
    }
    this.defenseTimer = 5_000;
  }

  private nextProjectType(engine: MatchEngine): BuildableType | null {
    while (this.nextBuildIndex < this.profile.buildOrder.length) {
      const type = this.profile.buildOrder[this.nextBuildIndex];
      const target = this.profile.targets[type] ?? 0;
      if (engine.buildingsOf(this.side, type).length < target) return type;
      this.nextBuildIndex += 1;
    }
    return null;
  }

  private nextProjectCost(engine: MatchEngine) {
    const type = this.nextProjectType(engine);
    return type ? BUILDING_STATS[type].cost : 0;
  }

  private tryBuildNext(engine: MatchEngine) {
    const type = this.nextProjectType(engine);
    if (!type) return;
    if (engine.state.players[this.side].gold < BUILDING_STATS[type].cost) return;
    if (placeBuilding(engine, this.side, type)) this.nextBuildIndex += 1;
  }

  private attackTarget(engine: MatchEngine) {
    const enemy: Side = this.side === 'blue' ? 'red' : 'blue';
    const dir = forwardDir(this.side);
    const candidates = engine
      .buildingsOf(enemy)
      .filter((b) => b.type !== 'fence')
      .sort((a, b) => dir * (a.x - b.x));
    return candidates.find((b) => b.type === 'tower' || b.type === 'barracks') ?? engine.castleOf(enemy) ?? candidates[0] ?? null;
  }
}

function runMatch(a: Strategy, b: Strategy, repeats: number): MatchMetrics[] {
  const metrics: MatchMetrics[] = [];
  for (let i = 0; i < repeats; i++) {
    const strategySide: Side = i % 2 === 0 ? 'blue' : 'red';
    const opponentSide: Side = strategySide === 'blue' ? 'red' : 'blue';
    const strategy = new StrategyController(strategySide, PROFILES[a]);
    const opponent = new StrategyController(opponentSide, PROFILES[b]);
    const engine = new MatchEngine();
    let peakArmy = 0;
    let peakSupply = 0;
    let peakUpkeep = 0;

    while (!engine.ended) {
      strategy.update(engine, GAME_RULES.tickMs);
      opponent.update(engine, GAME_RULES.tickMs);
      engine.update(GAME_RULES.tickMs);
      const army = engine.armyOf(strategySide).length;
      const supply = armySupplyCapacity(engine.buildingsOf(strategySide));
      peakArmy = Math.max(peakArmy, army);
      peakSupply = Math.max(peakSupply, supply);
      peakUpkeep = Math.max(peakUpkeep, armyUpkeep(army, supply));
      if (!Number.isFinite(engine.state.players[strategySide].gold) || engine.state.players[strategySide].gold < 0) {
        throw new Error(`Economy invariant failed in ${a} vs ${b}`);
      }
    }

    const result = engine.state.result!;
    const buildings = engine.buildingsOf(strategySide);
    metrics.push({
      strategy: a,
      side: strategySide,
      result: result.winner ?? 'draw',
      reason: result.reason,
      timeMs: result.timeMs,
      peakArmy,
      peakSupply,
      peakUpkeep,
      finalGold: engine.state.players[strategySide].gold,
      villages: buildings.filter((x) => x.type === 'village').length,
      barracks: buildings.filter((x) => x.type === 'barracks').length,
      towers: buildings.filter((x) => x.type === 'tower').length,
      fences: buildings.filter((x) => x.type === 'fence').length,
      firstAttackMs: strategy.metrics.firstAttackMs,
      firstOverSupplyMs: strategy.metrics.firstOverSupplyMs,
    });
  }
  return metrics;
}

const requested = Number(process.argv[2] ?? '4');
const repeats = Number.isFinite(requested) && requested > 0 ? Math.min(20, Math.floor(requested)) : 4;
const pairs: [Strategy, Strategy][] = [];
for (let i = 0; i < STRATEGIES.length; i++) {
  for (let j = i + 1; j < STRATEGIES.length; j++) pairs.push([STRATEGIES[i], STRATEGIES[j]]);
}

const started = Date.now();
for (const [a, b] of pairs) {
  const rows = runMatch(a, b, repeats);
  const wins = rows.filter((row) => row.result === row.side).length;
  const draws = rows.filter((row) => row.result === 'draw').length;
  const avg = (selector: (row: MatchMetrics) => number) => rows.reduce((sum, row) => sum + selector(row), 0) / rows.length;
  const firstAttack = rows.filter((row) => row.firstAttackMs !== null);
  const overSupply = rows.filter((row) => row.firstOverSupplyMs !== null);
  console.log(
    `${a} vs ${b}: strategy=${wins}/${rows.length} wins, draws=${draws}, ` +
      `avg=${(avg((row) => row.timeMs) / 60000).toFixed(2)}m, ` +
      `peakArmy=${avg((row) => row.peakArmy).toFixed(1)}, peakSupply=${avg((row) => row.peakSupply).toFixed(1)}, ` +
      `peakUpkeep=${avg((row) => row.peakUpkeep).toFixed(1)}, finalGold=${avg((row) => row.finalGold).toFixed(1)}, ` +
      `villages=${avg((row) => row.villages).toFixed(1)}, ` +
      `firstAttack=${firstAttack.length ? (avg((row) => row.firstAttackMs ?? 0) / 1000).toFixed(0) + 's' : 'n/a'}, ` +
      `overSupply=${overSupply.length ? (avg((row) => row.firstOverSupplyMs ?? 0) / 1000).toFixed(0) + 's' : 'n/a'}`
  );
}

console.log(`Balance lab finished in ${((Date.now() - started) / 1000).toFixed(1)}s with ${pairs.length * repeats} scripted matches.`);
