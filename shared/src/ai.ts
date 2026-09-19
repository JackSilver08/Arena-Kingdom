import type { MatchEngine, UnitState } from './engine.js';
import { BUILDING_STATS, GAME_RULES, UNIT_STATS, canPlaceBuilding, distanceToBuilding, forwardDir, territoryBounds } from './rules.js';
import { opponentOf, type BuildableType, type Difficulty, type Side, type UnitType } from './types.js';

interface BotProfile {
  thinkMs: number;
  villageTarget: number;
  barracksTarget: number;
  towerTarget: number;
  /** Fence segments laid along the frontline. */
  fenceTarget: number;
  /** Earliest time the bot launches an offensive. */
  firstAttackMs: number;
  /** Army size that triggers an attack wave. */
  attackArmy: number;
  /** Added to the wave threshold after each wave. */
  attackGrowth: number;
  defendRadius: number;
  /** Gold kept in reserve instead of recruiting. */
  reserve: number;
  /** Attack when the army clearly outnumbers the enemy's. */
  adaptive: boolean;
  retreats: boolean;
  /** Peace is accepted when own strength is below this share of the enemy's. */
  peaceThreshold: number;
  /** Home army must be at least this multiple of the enemy army before attacking. */
  attackRatio: number;
  armyCap: number;
  /** Chance per decision to spend gold on soldiers. */
  recruitChance: number;
}

export const BOT_PROFILES: Record<Difficulty, BotProfile> = {
  easy: {
    thinkMs: 2200,
    villageTarget: 3,
    barracksTarget: 1,
    towerTarget: 0,
    fenceTarget: 0,
    firstAttackMs: 150_000,
    attackArmy: 12,
    attackGrowth: 0,
    defendRadius: 110,
    reserve: 40,
    adaptive: false,
    retreats: false,
    peaceThreshold: 0.9,
    attackRatio: 0,
    armyCap: 14,
    recruitChance: 0.4
  },
  normal: {
    thinkMs: 1300,
    villageTarget: 5,
    barracksTarget: 2,
    towerTarget: 1,
    fenceTarget: 2,
    firstAttackMs: 110_000,
    attackArmy: 10,
    attackGrowth: 2,
    defendRadius: 150,
    reserve: 0,
    adaptive: false,
    retreats: false,
    peaceThreshold: 0.75,
    attackRatio: 1,
    armyCap: 45,
    recruitChance: 1
  },
  hard: {
    thinkMs: 650,
    villageTarget: 6,
    barracksTarget: 3,
    towerTarget: 2,
    fenceTarget: 4,
    firstAttackMs: 75_000,
    attackArmy: 9,
    attackGrowth: 3,
    defendRadius: 190,
    reserve: 0,
    adaptive: true,
    retreats: true,
    peaceThreshold: 0.6,
    attackRatio: 1.25,
    armyCap: GAME_RULES.limits.maxUnitsPerSide,
    recruitChance: 1
  }
};

type Phase = 'building' | 'attacking';

/** A computer opponent that issues the same commands a human player can. */
export class BotController {
  private readonly profile: BotProfile;
  private thinkTimer: number;
  private phase: Phase = 'building';
  private waveThreshold: number;
  private waveIds = new Set<number>();
  private waveSize = 0;

  constructor(
    readonly side: Side,
    readonly difficulty: Difficulty
  ) {
    this.profile = BOT_PROFILES[difficulty];
    this.thinkTimer = this.profile.thinkMs;
    this.waveThreshold = this.profile.attackArmy;
  }

  update(engine: MatchEngine, deltaMs: number) {
    if (engine.ended) return;
    this.thinkTimer -= deltaMs;
    if (this.thinkTimer > 0) return;
    this.thinkTimer = this.profile.thinkMs * (0.8 + Math.random() * 0.4);
    this.think(engine);
  }

  private think(engine: MatchEngine) {
    const { side, profile } = this;
    const state = engine.state;
    const enemy = opponentOf(side);
    const castle = engine.castleOf(side);
    if (!castle) return;

    this.answerPeace(engine);

    const army = engine.armyOf(side).filter((u) => u.type !== 'royal_guard');
    const enemyArmy = engine.armyOf(enemy).filter((u) => u.type !== 'royal_guard');
    const alive = new Set(army.map((u) => u.id));
    this.waveIds = new Set([...this.waveIds].filter((id) => alive.has(id)));

    // Defence: any enemy soldier close to one of our buildings.
    const ownBuildings = engine.buildingsOf(side);
    // Only soldiers that crossed into our half count as a threat.
    const midline = GAME_RULES.map.midlineX;
    const intruders = enemyArmy.filter(
      (u) =>
        forwardDir(side) * (u.x - midline) < 0 &&
        ownBuildings.some((b) => b.type !== 'fence' && distanceToBuilding(b, u.x, u.y) <= profile.defendRadius)
    );
    if (intruders.length) {
      const cx = intruders.reduce((sum, u) => sum + u.x, 0) / intruders.length;
      const cy = intruders.reduce((sum, u) => sum + u.y, 0) / intruders.length;
      const castleThreatened = intruders.some((u) => Math.hypot(castle.x - u.x, castle.y - u.y) < 200);
      const defenders = army.filter((u) => castleThreatened || !this.waveIds.has(u.id));
      if (defenders.length) {
        engine.command(side, { type: 'move', unitIds: defenders.map((u) => u.id), x: cx, y: cy, attack: true });
      }
      if (castleThreatened) {
        this.waveIds.clear();
        this.phase = 'building';
      }
    }

    // Economy and construction: decide on one project at a time and save for it.
    const villages = engine.buildingsOf(side, 'village').length;
    const barracks = engine.buildingsOf(side, 'barracks').length;
    const towers = engine.buildingsOf(side, 'tower').length;
    const fences = engine.buildingsOf(side, 'fence').length;
    const gold = () => state.players[side].gold;
    const underPressure = enemyArmy.length > army.length * 1.2 + 2;
    const wantTower = towers < profile.towerTarget + (intruders.length > 4 ? 1 : 0) && state.timeMs > 60_000;

    let project: BuildableType | null = null;
    if (barracks === 0) project = 'barracks';
    else if (intruders.length > 3 && wantTower) project = 'tower';
    else if (!underPressure && villages < profile.villageTarget && (army.length >= 3 || state.timeMs < 45_000)) project = 'village';
    else if (barracks < profile.barracksTarget && villages >= 2 + barracks * 2) project = 'barracks';
    else if (wantTower && !underPressure) project = 'tower';
    else if (fences < profile.fenceTarget && state.timeMs > 70_000 && army.length >= 6) project = 'fence';
    if (engine.buildingsOf(side).length >= GAME_RULES.limits.maxBuildingsPerSide) project = null;

    if (project && gold() >= BUILDING_STATS[project].cost) {
      this.tryBuild(engine, project);
      project = null;
    }

    // Recruitment: keep the barracks busy, unless saving for the next project.
    const saving = project !== null && !underPressure && !intruders.length && army.length >= 6;
    const reserve = profile.reserve + (saving && project ? BUILDING_STATS[project].cost : 0);
    if (Math.random() < profile.recruitChance || intruders.length) {
      for (const b of engine.buildingsOf(side, 'barracks')) {
        while (b.queue < 2 && engine.armyOf(side).length < profile.armyCap) {
          const unitType = b.trainType ?? this.recruitType();
          const unitCost = UNIT_STATS[unitType].cost;
          if (gold() < unitCost + reserve) break;
          if (!engine.command(side, { type: 'train', barracksId: b.id, unitType }).ok) break;
        }
      }
    }

    // Offence.
    const home = army.filter((u) => !this.waveIds.has(u.id));
    if (this.phase === 'attacking' && this.waveIds.size === 0) {
      this.phase = 'building';
      this.waveThreshold += profile.attackGrowth;
    }

    const readyToAttack =
      state.timeMs >= profile.firstAttackMs &&
      !intruders.length &&
      ((home.length >= this.waveThreshold && home.length >= enemyArmy.length * profile.attackRatio) ||
        (profile.adaptive && home.length >= 6 && home.length >= enemyArmy.length * 1.8) ||
        army.length >= profile.armyCap - 2);

    const target = this.attackTarget(engine);
    if (this.phase === 'building' && readyToAttack && target) {
      this.phase = 'attacking';
      this.waveIds = new Set(home.map((u) => u.id));
      this.waveSize = home.length;
      engine.command(side, { type: 'move', unitIds: home.map((u) => u.id), x: target.x, y: target.y, attack: true });
      return;
    }

    if (this.phase === 'attacking' && target) {
      const wave = army.filter((u) => this.waveIds.has(u.id));
      if (profile.retreats && this.shouldRetreat(wave, enemyArmy)) {
        const fallback = { x: castle.x - forwardDir(side) * 110, y: castle.y };
        engine.command(side, { type: 'move', unitIds: wave.map((u) => u.id), x: fallback.x, y: fallback.y, attack: false });
        this.waveIds.clear();
        this.phase = 'building';
        return;
      }
      // Keep the wave pushing once it has cleared its current destination.
      const idle = wave.filter((u) => u.order.kind === 'idle' && u.targetId === null);
      if (idle.length) {
        engine.command(side, { type: 'move', unitIds: idle.map((u) => u.id), x: target.x, y: target.y, attack: true });
      }
      // Reinforce an attack that is going well.
      if (this.difficulty !== 'easy' && home.length >= 5 && wave.length >= this.waveSize * 0.5 && !intruders.length) {
        const extra = home.slice(0, home.length - 2);
        extra.forEach((u) => this.waveIds.add(u.id));
        engine.command(side, { type: 'move', unitIds: extra.map((u) => u.id), x: target.x, y: target.y, attack: true });
      }
    }
  }

  private recruitType(): UnitType {
    const roll = Math.random();
    if (this.difficulty === 'hard') {
      if (roll < 0.07) return 'cannon';
      if (roll < 0.24) return 'knight';
      if (roll < 0.58) return 'archer';
      return 'soldier';
    }
    if (this.difficulty === 'normal') {
      if (roll < 0.03) return 'cannon';
      if (roll < 0.18) return 'knight';
      if (roll < 0.5) return 'archer';
      return 'soldier';
    }
    return roll < 0.2 ? 'archer' : 'soldier';
  }

  private shouldRetreat(wave: UnitState[], enemyArmy: UnitState[]) {
    if (!wave.length || wave.length >= this.waveSize * 0.4) return false;
    const cx = wave.reduce((sum, u) => sum + u.x, 0) / wave.length;
    const cy = wave.reduce((sum, u) => sum + u.y, 0) / wave.length;
    const nearby = enemyArmy.filter((u) => Math.hypot(u.x - cx, u.y - cy) < 260).length;
    return nearby > wave.length * 1.5;
  }

  /** The enemy building nearest to our side, so waves clear the way to the castle. */
  private attackTarget(engine: MatchEngine) {
    const enemy = opponentOf(this.side);
    const buildings = engine.buildingsOf(enemy).filter((b) => b.type !== 'fence');
    if (!buildings.length) return null;
    const castle = engine.castleOf(enemy);
    const dir = forwardDir(this.side);
    const frontline = buildings
      .filter((b) => b.type === 'tower' || b.type === 'barracks')
      .sort((a, b) => dir * (a.x - b.x))[0];
    const pick = this.difficulty === 'easy' || !frontline ? castle ?? buildings[0] : frontline;
    return { x: pick.x - dir * (BUILDING_STATS[pick.type].halfWidth + 16), y: pick.y };
  }

  private answerPeace(engine: MatchEngine) {
    const peace = engine.state.peace;
    if (!peace || peace.proposedBy === this.side) return;
    const accept = this.strength(engine, this.side) < this.strength(engine, opponentOf(this.side)) * this.profile.peaceThreshold;
    engine.command(this.side, { type: 'respondPeace', accept });
  }

  private strength(engine: MatchEngine, side: Side) {
    const castle = engine.castleOf(side);
    const castleShare = castle ? castle.hp / castle.maxHp : 0;
    return engine.armyOf(side).filter((u) => u.type !== 'royal_guard').length * 2 + engine.buildingsOf(side, 'village').length * 3 + castleShare * 20;
  }

  private tryBuild(engine: MatchEngine, type: BuildableType) {
    const castle = engine.castleOf(this.side);
    if (!castle) return false;
    const dir = forwardDir(this.side);
    const stats = BUILDING_STATS[type];
    const bounds = territoryBounds(this.side, stats.halfWidth + 8, stats.halfHeight + 8);
    const frontX = dir > 0 ? bounds.maxX : bounds.minX;
    const candidates: { x: number; y: number }[] = [];
    if (type === 'fence') {
      const height = stats.halfHeight * 2;
      for (const k of [0, -1, 1, -2, 2, -3, 3]) candidates.push({ x: frontX, y: castle.y + k * height });
    }
    for (let attempt = 0; attempt < 40; attempt++) {
      const spread = (range: number) => (Math.random() - 0.5) * range;
      if (type === 'village') candidates.push({ x: castle.x + dir * (20 + Math.random() * 150), y: castle.y + spread(640) });
      else if (type === 'barracks') candidates.push({ x: castle.x + dir * (110 + Math.random() * 120), y: castle.y + spread(460) });
      else if (type === 'tower') candidates.push({ x: frontX - dir * (30 + Math.random() * 70), y: castle.y + spread(420) });
      else candidates.push({ x: frontX - dir * Math.random() * 40, y: castle.y + spread(600) });
    }
    candidates.push({
      x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
      y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY)
    });
    for (const { x, y } of candidates) {
      if (canPlaceBuilding(engine.state.buildings, this.side, type, x, y).ok) {
        return engine.command(this.side, { type: 'build', building: type, x, y }).ok;
      }
    }
    return false;
  }
}
