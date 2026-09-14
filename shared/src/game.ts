export type PlayerId = 'playerA' | 'playerB';

export enum BuildingType {
  Castle = 'castle',
  Village = 'village',
  Barracks = 'barracks',
  Tower = 'tower'
}

export enum UnitType {
  Soldier = 'soldier'
}

export enum ArmySelection {
  All = 'all',
  OneThird = 'one-third',
  TwoThirds = 'two-thirds'
}

export type Vec2 = {
  x: number;
  y: number;
};

export type BuildingState = {
  id: string;
  owner: PlayerId;
  type: BuildingType;
  position: Vec2;
  hp: number;
};

export type UnitState = {
  id: string;
  owner: PlayerId;
  type: UnitType;
  position: Vec2;
  hp: number;
  maxHp: number;
  attack: number;
  attackRange: number;
  speed: number;
  targetId?: string;
};

export type KingdomState = {
  gold: number;
  buildings: BuildingState[];
  units: UnitState[];
};

export const GAME_RULES = {
  map: {
    width: 1280,
    height: 720,
    arena: { x: 390, y: 90, width: 500, height: 540 },
    midlineY: 360
  },
  economy: {
    startingGold: 100,
    villageCost: 75,
    villageIncome: 5,
    incomeIntervalMs: 5000,
    soldierCost: 20,
    soldierTrainMs: 2500
  },
  combat: {
    soldierHp: 100,
    soldierAttack: 16,
    soldierRange: 34,
    soldierSpeed: 58,
    castleHp: 1200,
    barracksHp: 500,
    villageHp: 350,
    towerHp: 700,
    towerRange: 130,
    towerDamage: 10
  }
} as const;
