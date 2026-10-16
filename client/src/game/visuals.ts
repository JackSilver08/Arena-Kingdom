import Phaser from 'phaser';
import { GAME_RULES, MOUNTAIN_RIDGES, coastline, type BuildingType, type Side, type UnitType } from '@arena-kingdom/shared';
import { svgDataUrl } from './art';
import { arenaMapArtV2, type MapViewSize } from './mapArt';
import { arenaMapArtMoba } from './mobaMapArt';
import { arenaMapArtAtlas } from './atlasMapArt';
import { ATLAS_SIZE, atlasEntityArt, type AtlasEntity } from './atlasEntityArt';
import type { SymbolSize } from './symbols';
import { FANTASY_SIZE, fantasyEntityArt, type FantasyEntity } from './fantasyArt';
import { terrainRasterSize, type ArtQuality } from './terrainArt';
import { terrainView } from './battleLayout';
export { battleView } from './battleLayout';
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
const mapTextureKey = (view: MapViewSize, style: MapStyle, quality: ArtQuality, nature: boolean) => `${MAP_TEXTURE}-${style}-${view.width}x${view.height}-${quality}-${nature}`;

/** Pick the correct map art generator based on the chosen style. */
function mapArtForStyle(view: MapViewSize, style: MapStyle, quality: ArtQuality, nature: boolean): string {
  if (style === 'atlas') return arenaMapArtAtlas(view, quality, nature);
  if (style === 'moba') return arenaMapArtMoba(view, quality, nature);
  return arenaMapArtV2(view, style);
}

export class BattleVisualRenderer {
  private terrain: Phaser.GameObjects.Image | null = null;
  private mapStyle: MapStyle;
  private quality: ArtQuality = loadDisplaySettings().quality;
  private nature = loadDisplaySettings().nature;
  private readonly pending = new Map<string, { width: number; height: number; view?: MapViewSize }>();
  private readonly onDisplaySettings = (event: Event) => {
    const settings = (event as CustomEvent<DisplaySettings>).detail;
    if (!settings) return;
    this.quality = settings.quality;
    this.nature = settings.nature;
    this.setMapStyle(settings.mapStyle);
  };
  private readonly onLoadError = (file: Phaser.Loader.File) => {
    if (!this.pending.has(file.key)) return;
    console.warn(`[Arena graphics] ${file.key} failed to rasterise; using local fallback.`);
  };
  private readonly onLoadComplete = () => {
    for (const [key, size] of this.pending) {
      if (!this.scene.textures.exists(key)) this.fallbackTexture(key, size);
    }
    this.pending.clear();
    if (this.terrain) this.refreshTerrain();
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly resolution: number,
    private view: MapViewSize,
    mapStyle: MapStyle = loadDisplaySettings().mapStyle
  ) {
    this.view = terrainView(view);
    this.mapStyle = mapStyle;
    window.addEventListener(DISPLAY_SETTINGS_EVENT, this.onDisplaySettings);
    this.scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, this.onLoadError);
    this.scene.load.on(Phaser.Loader.Events.COMPLETE, this.onLoadComplete);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener(DISPLAY_SETTINGS_EVENT, this.onDisplaySettings);
      this.scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, this.onLoadError);
      this.scene.load.off(Phaser.Loader.Events.COMPLETE, this.onLoadComplete);
      this.pending.clear();
    });
  }

  private load(key: string, markup: string, width: number, height: number, view?: MapViewSize) {
    if (this.scene.textures.exists(key) || this.pending.has(key)) return;
    this.pending.set(key, { width, height, view });
    this.scene.load.svg(key, svgDataUrl(markup, width, height));
  }

  preload() {
    // Complete original roster. Neutral materials remain intact; only cloth/crests carry team colour.
    const scale = Math.max(1, Math.min(2, this.resolution));
    for (const side of ['blue', 'red'] as const) {
      for (const type of Object.keys(FANTASY_SIZE) as FantasyEntity[]) {
        const size = FANTASY_SIZE[type];
        this.load(`${type}-${side}`, fantasyEntityArt(type, side), Math.round(size.width * scale), Math.round(size.height * scale));
      }
    }
    // Pre-rasterise the compact hand-inked roster once. Sprites share textures.
    for (const side of ['blue', 'red'] as const) {
      for (const type of Object.keys(ATLAS_SIZE) as AtlasEntity[]) {
        const size = ATLAS_SIZE[type];
        this.load(`atlas-${type}-${side}`, atlasEntityArt(type, side), Math.round(size.width * scale), Math.round(size.height * scale));
      }
    }
    this.loadTerrain();
  }

  drawTerrain() {
    const { width, height } = GAME_RULES.map;
    const key = this.terrainKey();
    if (!this.scene.textures.exists(key)) this.fallbackTexture(key, { ...terrainRasterSize(this.view.width, this.view.height, this.quality), view: this.view });
    // Resolution is bounded independently of world size and device DPR.
    this.terrain = this.scene.add
      .image(width / 2, height / 2, key)
      .setOrigin(0.5)
      .setDisplaySize(this.view.width, this.view.height)
      .setDepth(BATTLE_DEPTH.water);
    this.removeStaleMapTextures(key);
    return this.terrain;
  }

  /** Apply a presentation-only map style without touching world coordinates, entities or pathfinding. */
  setMapStyle(style: MapStyle) {
    this.mapStyle = style;
    this.refreshTerrain();
  }

  /** Redraws the map for a new view size. The current map stays on screen until the new one is ready. */
  resizeTerrain(view: MapViewSize) {
    this.view = terrainView(view);
    this.refreshTerrain();
  }

  private terrainKey() { return mapTextureKey(this.view, this.mapStyle, this.quality, this.nature); }

  private loadTerrain() {
    const size = terrainRasterSize(this.view.width, this.view.height, this.quality);
    this.load(this.terrainKey(), mapArtForStyle(this.view, this.mapStyle, this.quality, this.nature), size.width, size.height, { ...this.view });
  }

  private refreshTerrain() {
    if (!this.terrain) return;
    const key = this.terrainKey();
    if (this.scene.textures.exists(key)) {
      this.terrain.setTexture(key).setDisplaySize(this.view.width, this.view.height);
      this.removeStaleMapTextures(key);
    } else if (!this.scene.load.isLoading()) {
      // Coalesce resize/style/quality bursts; at most one map is queued beside the active texture.
      this.removeStaleMapTextures(this.terrain.texture.key);
      this.loadTerrain();
      this.scene.load.start();
    }
  }

  private fallbackTexture(key: string, size: { width: number; height: number; view?: MapViewSize }) {
    const texture = this.scene.textures.createCanvas(key, size.width, size.height);
    if (!texture) return;
    const ctx = texture.context;
    if (size.view) {
      const view = size.view;
      ctx.fillStyle = '#173e50'; ctx.fillRect(0, 0, size.width, size.height);
      ctx.scale(size.width / view.width, size.height / view.height);
      ctx.translate((view.width - GAME_RULES.map.width) / 2, (view.height - GAME_RULES.map.height) / 2);
      ctx.beginPath();
      coastline(320).forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.closePath(); ctx.fillStyle = '#668054'; ctx.fill(); ctx.clip();
      for (const r of MOUNTAIN_RIDGES) {
        ctx.beginPath(); ctx.ellipse(r.cx, r.cy, r.rx, r.ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#52666c'; ctx.fill(); ctx.strokeStyle = '#c9c7a6'; ctx.lineWidth = 3; ctx.stroke();
      }
    } else {
      const red = key.endsWith('-red');
      ctx.scale(size.width / 100, size.height / 100);
      ctx.fillStyle = '#a9b5a5'; ctx.strokeStyle = '#243b43'; ctx.lineWidth = 4;
      const type = key.split('-')[0] as FantasyEntity;
      const foot = FANTASY_SIZE[type]?.anchorY ?? .8;
      ctx.fillRect(25, foot * 100 - 40, 50, 40); ctx.strokeRect(25, foot * 100 - 40, 50, 40);
      ctx.fillStyle = red ? '#cd5960' : '#459bd3'; ctx.fillRect(40, foot * 100 - 29, 20, 16);
    }
    texture.refresh();
  }

  private removeStaleMapTextures(activeKey: string) {
    for (const old of this.scene.textures.getTextureKeys()) {
      if (old.startsWith(MAP_TEXTURE) && old !== activeKey) this.scene.textures.remove(old);
    }
  }

  get isAtlas() { return this.mapStyle === 'atlas'; }

  building(type: BuildingType, side: Side): EntityVisual {
    return this.isAtlas
      ? { key: `atlas-${type}-${side}`, ...ATLAS_SIZE[type] }
      : { key: buildingTextureKey(type, side), ...FANTASY_SIZE[type] };
  }

  unit(type: UnitType, side: Side): EntityVisual {
    return this.isAtlas
      ? { key: `atlas-${type}-${side}`, ...ATLAS_SIZE[type] }
      : { key: unitTextureKey(type, side), ...FANTASY_SIZE[type] };
  }
}
