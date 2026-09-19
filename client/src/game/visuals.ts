import Phaser from 'phaser';
import { GAME_RULES, type BuildingType, type Side, type UnitType } from '@arena-kingdom/shared';
import { svgDataUrl } from './art';
import { knightIconDataUrl } from './knightIcon';
import { arenaMapArtV2, type MapViewSize } from './mapArt';
import { SYMBOL_SIZE, symbolArt, type SymbolSize } from './symbols';
import {
  DISPLAY_SETTINGS_EVENT,
  loadDisplaySettings,
  type DisplaySettings,
  type MapStyle
} from './displaySettings';

/**
 * Rendering-only depth bands. Game rules use world coordinates only; they
 * never need to know how a building, a unit, or the terrain is drawn.
 * Documentary overlays remain below entity symbols and health bars.
 */
export const BATTLE_DEPTH = {
  water: 0,
  terrain: 10,
  influence: 20,
  frontline: 30,
  ground: 50,
  arrows: 55,
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

/** How an entity is drawn: its texture and the world-size footprint of the image. */
export interface EntityVisual extends SymbolSize {
  key: string;
}

export function buildingTextureKey(type: BuildingType, side: Side) {
  return `${type}-${side}`;
}

export function unitTextureKey(type: UnitType, side: Side) {
  return `${type}-${side}`;
}

const MAP_TEXTURE = 'arena-map';
const mapTextureKey = (view: MapViewSize, style: MapStyle) => `${MAP_TEXTURE}-${style}-${view.width}x${view.height}`;

export class BattleVisualRenderer {
  private terrain: Phaser.GameObjects.Image | null = null;
  private mapStyle: MapStyle;
  private readonly onDisplaySettings = (event: Event) => {
    const settings = (event as CustomEvent<DisplaySettings>).detail;
    if (settings?.mapStyle) this.setMapStyle(settings.mapStyle);
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly resolution: number,
    private view: MapViewSize,
    mapStyle: MapStyle = loadDisplaySettings().mapStyle
  ) {
    this.mapStyle = mapStyle;
    window.addEventListener(DISPLAY_SETTINGS_EVENT, this.onDisplaySettings);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener(DISPLAY_SETTINGS_EVENT, this.onDisplaySettings);
    });
  }

  private load(key: string, markup: string, width: number, height: number) {
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.scene.load.svg(key, svgDataUrl(markup, width * this.resolution, height * this.resolution));
  }

  private loadImageData(key: string, dataUrl: string) {
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.scene.load.image(key, dataUrl);
  }

  preload() {
    const load = this.load.bind(this);

    // The battlefield uses map symbols; menus and the HUD keep the illustrated art.
    for (const side of ['blue', 'red'] as const) {
      for (const type of ['castle', 'village', 'barracks', 'fence', 'tower'] as BuildingType[]) {
        const size = SYMBOL_SIZE[type];
        load(buildingTextureKey(type, side), symbolArt(type, side), size.width, size.height);
      }
      const troop = SYMBOL_SIZE.troop;
      load(unitTextureKey('soldier', side), symbolArt('troop', side), troop.width, troop.height);
      const militia = SYMBOL_SIZE.militia;
      load(unitTextureKey('militia', side), symbolArt('militia', side), militia.width, militia.height);
      const archer = SYMBOL_SIZE.archer;
      load(unitTextureKey('archer', side), symbolArt('archer', side), archer.width, archer.height);
      const scout = SYMBOL_SIZE.scout;
      load(unitTextureKey('scout', side), symbolArt('scout', side), scout.width, scout.height);
      const royalGuard = SYMBOL_SIZE.royal_guard;
      load(unitTextureKey('royal_guard', side), symbolArt('royal_guard', side), royalGuard.width, royalGuard.height);
      // Knight keeps its illustrated glyph; Cannon uses the compact battlefield SVG symbol.
      this.loadImageData(unitTextureKey('knight', side), knightIconDataUrl(side));
      const cannon = SYMBOL_SIZE.cannon;
      load(unitTextureKey('cannon', side), symbolArt('cannon', side), cannon.width, cannon.height);
    }

    load(mapTextureKey(this.view, this.mapStyle), arenaMapArtV2(this.view, this.mapStyle), this.view.width, this.view.height);
  }

  drawTerrain() {
    const { width, height } = GAME_RULES.map;
    // The texture is rasterised at the render resolution; display it at world size.
    this.terrain = this.scene.add
      .image(width / 2, height / 2, mapTextureKey(this.view, this.mapStyle))
      .setOrigin(0.5)
      .setDisplaySize(this.view.width, this.view.height)
      .setDepth(BATTLE_DEPTH.water);
    return this.terrain;
  }

  /** Apply a presentation-only map style without touching world coordinates, entities or pathfinding. */
  setMapStyle(style: MapStyle) {
    if (style === this.mapStyle && this.terrain?.texture.key === mapTextureKey(this.view, style)) return;
    this.mapStyle = style;
    const view = this.view;
    const key = mapTextureKey(view, style);
    const apply = () => {
      if (key !== mapTextureKey(this.view, this.mapStyle) || !this.terrain || !this.scene.textures.exists(key)) return;
      this.terrain.setTexture(key).setDisplaySize(view.width, view.height);
      this.removeStaleMapTextures(key);
    };
    if (this.scene.textures.exists(key)) return apply();
    this.load(key, arenaMapArtV2(view, style), view.width, view.height);
    this.scene.load.once(Phaser.Loader.Events.COMPLETE, apply);
    this.scene.load.start();
  }

  /** Redraws the map for a new view size. The current map stays on screen until the new one is ready. */
  resizeTerrain(view: MapViewSize) {
    this.view = view;
    const key = mapTextureKey(view, this.mapStyle);
    const apply = () => {
      // A later resize or style change may have superseded this one while it was loading.
      if (key !== mapTextureKey(this.view, this.mapStyle) || !this.terrain || !this.scene.textures.exists(key)) return;
      this.terrain.setTexture(key).setDisplaySize(view.width, view.height);
      this.removeStaleMapTextures(key);
    };
    if (this.scene.textures.exists(key)) return apply();
    this.load(key, arenaMapArtV2(view, this.mapStyle), view.width, view.height);
    this.scene.load.once(Phaser.Loader.Events.COMPLETE, apply);
    this.scene.load.start();
  }

  private removeStaleMapTextures(activeKey: string) {
    for (const old of this.scene.textures.getTextureKeys()) {
      if (old.startsWith(MAP_TEXTURE) && old !== activeKey) this.scene.textures.remove(old);
    }
  }

  building(type: BuildingType, side: Side): EntityVisual {
    return { key: buildingTextureKey(type, side), ...SYMBOL_SIZE[type] };
  }

  unit(type: UnitType, side: Side): EntityVisual {
    const glyph = type === 'soldier' ? SYMBOL_SIZE.troop : SYMBOL_SIZE[type];
    return { key: unitTextureKey(type, side), ...glyph, anchorY: glyph.anchorY };
  }
}