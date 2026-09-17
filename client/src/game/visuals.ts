import Phaser from 'phaser';
import { GAME_RULES, type BuildingType, type Side, type UnitType } from '@arena-kingdom/shared';
import { buildingArt, fenceWallArt, SPRITE_SIZE, svgDataUrl, troopArt } from './art';
import { arenaMapArtV2, type MapViewSize } from './mapArt';
import { villageArt } from './villageArt';

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

/** Wider or taller screens than this get bars rather than an ever larger map to rasterise. */
const VIEW_ASPECT = { min: 4 / 3, max: 2.4 };

/**
 * The part of the world shown on a stage: the whole battlefield, widened or heightened so it
 * fills the stage instead of leaving bars beside the map. Always even, so it centres exactly.
 */
export function battleView(stageWidth: number, stageHeight: number): MapViewSize {
  const { width, height } = GAME_RULES.map;
  const aspect = Math.min(VIEW_ASPECT.max, Math.max(VIEW_ASPECT.min, stageWidth / Math.max(1, stageHeight)));
  const even = (value: number) => 2 * Math.round(value / 2);
  return { width: even(Math.max(width, height * aspect)), height: even(Math.max(height, width / aspect)) };
}

export interface EntityVisual {
  key: string;
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

export function buildingTextureKey(type: BuildingType, side: Side) {
  return `${type}-${side}`;
}

export function unitTextureKey(type: UnitType, side: Side) {
  return `${type}-${side}`;
}

const MAP_TEXTURE = 'arena-map';
const mapTextureKey = (view: MapViewSize) => `${MAP_TEXTURE}-${view.width}x${view.height}`;

export class BattleVisualRenderer {
  private terrain: Phaser.GameObjects.Image | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly resolution: number,
    private view: MapViewSize
  ) {}

  private load(key: string, markup: string, width: number, height: number) {
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.scene.load.svg(key, svgDataUrl(markup, width * this.resolution, height * this.resolution));
  }

  preload() {
    const load = this.load.bind(this);

    for (const side of ['blue', 'red'] as const) {
      for (const type of ['castle', 'village', 'barracks', 'fence', 'tower'] as BuildingType[]) {
        const size = SPRITE_SIZE[type];
        // The build menu keeps the side-on fence icon; on the battlefield fences stand vertically.
        const markup = type === 'village' ? villageArt(side) : type === 'fence' ? fenceWallArt() : buildingArt(type, side);
        load(buildingTextureKey(type, side), markup, size.width, size.height);
      }
      const troop = SPRITE_SIZE.troop;
      load(unitTextureKey('soldier', side), troopArt(side), troop.width, troop.height);
    }

    load(mapTextureKey(this.view), arenaMapArtV2(this.view), this.view.width, this.view.height);
  }

  drawTerrain() {
    const { width, height } = GAME_RULES.map;
    // The texture is rasterised at the render resolution; display it at world size.
    this.terrain = this.scene.add
      .image(width / 2, height / 2, mapTextureKey(this.view))
      .setOrigin(0.5)
      .setDisplaySize(this.view.width, this.view.height)
      .setDepth(BATTLE_DEPTH.water);
    return this.terrain;
  }

  /** Redraws the map for a new view size. The current map stays on screen until the new one is ready. */
  resizeTerrain(view: MapViewSize) {
    this.view = view;
    const key = mapTextureKey(view);
    const apply = () => {
      // A later resize may have superseded this one while it was loading.
      if (key !== mapTextureKey(this.view) || !this.terrain || !this.scene.textures.exists(key)) return;
      this.terrain.setTexture(key).setDisplaySize(view.width, view.height);
      for (const old of this.scene.textures.getTextureKeys()) {
        if (old.startsWith(MAP_TEXTURE) && old !== key) this.scene.textures.remove(old);
      }
    };
    if (this.scene.textures.exists(key)) return apply();
    this.load(key, arenaMapArtV2(view), view.width, view.height);
    this.scene.load.once(Phaser.Loader.Events.COMPLETE, apply);
    this.scene.load.start();
  }

  building(type: BuildingType, side: Side): EntityVisual {
    return { key: buildingTextureKey(type, side), fallbackEmoji: fallbackBuilding[type] };
  }

  unit(type: UnitType, side: Side): EntityVisual {
    return { key: unitTextureKey(type, side), fallbackEmoji: fallbackUnit[type] };
  }
}
