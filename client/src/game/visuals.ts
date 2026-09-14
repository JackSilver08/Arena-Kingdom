import Phaser from 'phaser';
import type { BuildingType, Side, UnitType } from '@arena-kingdom/shared';
import { arenaMapArt, buildingArt, SPRITE_SIZE, svgDataUrl, troopArt } from './art';

/**
 * Rendering-only depth bands. Game rules use world coordinates only; they
 * never need to know how a building, a unit, or the terrain is drawn.
 */
export const BATTLE_DEPTH = {
  water: 0,
  terrain: 10,
  ground: 50,
  entities: 60,
  bars: 1500,
  overlay: 1600,
  effects: 1700
} as const;

export interface EntityVisual {
  /** Phaser texture key for the production vector sprite. */
  key: string;
  /** Kept deliberately separate so an unavailable asset never leaks into game logic. */
  fallbackEmoji: string;
}

const fallbackBuilding: Record<BuildingType, string> = {
  castle: '🏰',
  village: '🏘️',
  barracks: '⚔️',
  fence: '🪵',
  tower: '🗼'
};

const fallbackUnit: Record<UnitType, string> = { soldier: '🛡️' };

/** Every building gets a team-aware texture, even visual-only structures. */
export function buildingTextureKey(type: BuildingType, side: Side) {
  return `${type}-${side}`;
}

export function unitTextureKey(type: UnitType, side: Side) {
  return `${type}-${side}`;
}

/**
 * Owns loading and lookup of presentation assets. The SVGs are compact,
 * original artwork; callers receive texture keys and never see SVG markup.
 */
export class BattleVisualRenderer {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly resolution: number,
    private readonly width: number,
    private readonly height: number
  ) {}

  preload() {
    const load = (key: string, markup: string, width: number, height: number) => {
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
      this.scene.load.svg(key, svgDataUrl(markup, width * this.resolution, height * this.resolution));
    };

    for (const side of ['blue', 'red'] as const) {
      for (const type of ['castle', 'village', 'barracks', 'fence', 'tower'] as BuildingType[]) {
        const size = SPRITE_SIZE[type];
        load(buildingTextureKey(type, side), buildingArt(type, side), size.width, size.height);
      }
      const troop = SPRITE_SIZE.troop;
      load(unitTextureKey('soldier', side), troopArt(side), troop.width, troop.height);
    }
    load('arena-map', arenaMapArt(), this.width, this.height);
  }

  drawTerrain() {
    return this.scene.add.image(this.width / 2, this.height / 2, 'arena-map').setOrigin(0.5).setDepth(BATTLE_DEPTH.water);
  }

  building(type: BuildingType, side: Side): EntityVisual {
    return { key: buildingTextureKey(type, side), fallbackEmoji: fallbackBuilding[type] };
  }

  unit(type: UnitType, side: Side): EntityVisual {
    return { key: unitTextureKey(type, side), fallbackEmoji: fallbackUnit[type] };
  }
}
