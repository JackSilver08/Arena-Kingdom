import Phaser from 'phaser';
import {
  BUILDING_STATS,
  FORMATION_STATS,
  GAME_RULES,
  UNIT_STATS,
  distanceToBuilding,
  formationOffsets,
  territoryOutline,
  type BuildingType,
  type BuildingView,
  type GameEvent,
  type MatchView,
  type Side,
  type UnitView
} from '@arena-kingdom/shared';
import type { GameController } from './GameController';
import { DisplaySettingsPanel } from './displaySettingsPanel';
import { createBattleRecap } from './battleRecap';
import { FrontlineOverlay } from './frontlineOverlay';
import type { MapViewSize } from './mapArt';
import { BATTLE_DEPTH, BattleVisualRenderer, battleView } from './visuals';
import { svgDataUrl } from './art';

const { width: W, height: H } = GAME_RULES.map;
const UI_FONT = '"Segoe UI", Arial, system-ui, sans-serif';
const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
const SIDE_COLOR: Record<Side, number> = { blue: 0x3b82f6, red: 0xef4444 };
/** Dark ink drawn under yellow highlights so they stay readable on the pale paper map. */
const INK = 0x2b1d0e;
const UNIT_RADIUS = UNIT_STATS.soldier.radius;
const DRAG_THRESHOLD = 6;
/** Window resizes arrive in bursts; the map is only redrawn once they settle. */
const RESIZE_SETTLE_MS = 200;
const MAX_EFFECTS = 90;
const DEPTH = BATTLE_DEPTH;
const FOG_CLOUD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 360">
  <defs>
    <filter id="fog-soft" x="-30%" y="-35%" width="160%" height="170%">
      <feGaussianBlur stdDeviation="16"/>
    </filter>
    <filter id="fog-soft-core" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8"/>
    </filter>
  </defs>
  <g filter="url(#fog-soft)">
    <ellipse cx="112" cy="190" rx="118" ry="86" fill="#E9EDF0" fill-opacity=".42"/>
    <ellipse cx="238" cy="128" rx="144" ry="104" fill="#D7DDE2" fill-opacity=".82"/>
    <ellipse cx="382" cy="172" rx="126" ry="96" fill="#D7DDE2" fill-opacity=".78"/>
    <ellipse cx="332" cy="276" rx="158" ry="72" fill="#C9D1D8" fill-opacity=".72"/>
    <ellipse cx="158" cy="286" rx="146" ry="62" fill="#D7DDE2" fill-opacity=".7"/>
  </g>
  <g filter="url(#fog-soft-core)" opacity=".7">
    <ellipse cx="250" cy="180" rx="104" ry="78" fill="#C9D1D8" fill-opacity=".7"/>
    <ellipse cx="404" cy="238" rx="78" ry="60" fill="#F5F7F8" fill-opacity=".5"/>
  </g>
</svg>`;

interface UnitSprite {
  image: Phaser.GameObjects.Image;
  x: number;
  y: number;
  bob: number;
  seen: number;
}

interface BuildingSprite {
  image: Phaser.GameObjects.Image;
  queue: Phaser.GameObjects.Text | null;
  seen: number;
  lastHp: number;
  hurtUntil: number;
}

export class BattleScene extends Phaser.Scene {
  private controller!: GameController;
  private visuals!: BattleVisualRenderer;
  private frontline!: FrontlineOverlay;
  private displaySettings: DisplaySettingsPanel | null = null;
  private recap!: ReturnType<typeof createBattleRecap>;
  private replayView: MatchView | null = null;
  private overlaysEnabled = true;
  private formationsEnabled = false;
  private reducedMotion = false;
  private res = 1;
  private smoothing = false;
  private units = new Map<number, UnitSprite>();
  private buildings = new Map<number, BuildingSprite>();
  private ground!: Phaser.GameObjects.Graphics;
  private bars!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private fogMemory!: Phaser.GameObjects.Graphics;
  private fogEraser!: Phaser.GameObjects.Graphics;
  private fogTexture!: Phaser.GameObjects.RenderTexture;
  private ghost!: Phaser.GameObjects.Image;
  private lastKnown = new Map<number, { side: Side; type: UnitView['type'] | BuildingType; kind: 'unit' | 'building'; x: number; y: number; seenAt: number }>();
  private readonly fogMemoryMs = 12_000;
  private frameNo = 0;
  private firstSync = true;
  private dragStart: { x: number; y: number } | null = null;
  private pointerWorld = { x: 0, y: 0 };
  private effects = 0;
  private view!: MapViewSize;
  private resizeTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('battle');
  }

  init(data: { controller: GameController; resolution: number; view: MapViewSize }) {
    this.controller = data.controller;
    this.res = data.resolution;
    this.smoothing = data.controller.session.mode === 'pvp';
    this.view = data.view;
    this.visuals = new BattleVisualRenderer(this, this.res, data.view);
  }

  preload() {
    this.visuals.preload();
    this.load.svg('fog-cloud', svgDataUrl(FOG_CLOUD_SVG, 520, 360));
  }

  create() {
    const camera = this.cameras.main;
    camera.setZoom(this.res);
    camera.centerOn(W / 2, H / 2);

    this.makeEffectTextures();
    this.drawWorld();
    this.frontline = new FrontlineOverlay(this);
    this.ground = this.add.graphics().setDepth(DEPTH.ground);
    this.bars = this.add.graphics().setDepth(DEPTH.bars);
    this.overlay = this.add.graphics().setDepth(DEPTH.overlay);
    this.fogTexture = this.add.renderTexture(0, 0, W, H).setOrigin(0, 0).setDepth(DEPTH.overlay - 20);
    this.fogMemory = this.add.graphics().setDepth(DEPTH.overlay - 10);
    this.fogEraser = this.add.graphics().setVisible(false);
    this.ghost = this.add
      .image(0, 0, this.visuals.building('village', this.controller.mySide).key)
      .setDepth(DEPTH.overlay)
      .setVisible(false);

    const battleRoot = this.sys.game.canvas.closest('.battle') as HTMLElement | null;
    if (battleRoot) {
      this.displaySettings = new DisplaySettingsPanel(battleRoot, (settings) => {
        this.overlaysEnabled = settings.overlays;
        this.formationsEnabled = settings.formations;
        this.reducedMotion = settings.reducedMotion;
      });
      this.recap = createBattleRecap(this, battleRoot, this.controller);
    }

    this.bindInput();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.queueFitView, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.queueFitView, this);
      this.displaySettings?.destroy();
      this.displaySettings = null;
      this.recap?.destroy();
      this.frontline?.destroy();
    });
    // The stage may have changed shape while the textures were loading.
    this.fitView();
  }

  update(_time: number, delta: number) {
    const events = this.controller.tick(delta);
    const liveView = this.controller.view;
    if (liveView && !this.replayView) {
      this.recap.record(liveView, events);
    }
    const view = this.replayView ?? liveView;
    if (view) {
      this.sync(view, delta);
      this.drawFog(view);
      this.frontline.update(view, delta, this.overlaysEnabled, this.reducedMotion);
    }
    if (!this.replayView) this.playEvents(events);
    this.drawOverlay(view);
  }

  /** Switch the renderer between the live match state and a recorded recap frame. */
  setReplayView(view: MatchView | null) {
    this.replayView = view;
    if (view) {
      this.sync(view, 1);
      this.drawFog(view);
      this.frontline.update(view, 0, this.overlaysEnabled, true);
    }
  }

  // ---------------------------------------------------------------- setup

  private makeEffectTextures() {
    const r = this.res;
    const make = (key: string, size: number, draw: (g: Phaser.GameObjects.Graphics, c: number) => void) => {
      if (this.textures.exists(key)) this.textures.remove(key);
      const g = this.make.graphics({}, false);
      draw(g, (size * r) / 2);
      g.generateTexture(key, size * r, size * r);
      g.destroy();
    };
    make('spark', 16, (g, c) => {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(c, c, 3 * r);
      g.fillStyle(0xfff3a1, 0.7);
      g.fillCircle(c, c, 6 * r);
    });
    make('ring', 64, (g, c) => {
      g.lineStyle(3 * r, 0xffffff, 1);
      g.strokeCircle(c, c, 28 * r);
    });
    make('arrow', 24, (g, c) => {
      g.lineStyle(2 * r, 0x3f2a14, 1);
      g.lineBetween(c - 9 * r, c, c + 7 * r, c);
      g.fillStyle(0x3f2a14, 1);
      g.fillTriangle(c + 10 * r, c, c + 5 * r, c - 3 * r, c + 5 * r, c + 3 * r);
    });
  }

  private drawWorld() {
    this.visuals.drawTerrain();
  }

  private queueFitView() {
    this.resizeTimer?.remove();
    this.resizeTimer = this.time.delayedCall(RESIZE_SETTLE_MS, () => this.fitView());
  }

  /** Keeps the map filling the stage when it changes shape, e.g. after a window resize or entering full screen. */
  private fitView() {
    const view = battleView(this.scale.parentSize.width, this.scale.parentSize.height);
    if (view.width === this.view.width && view.height === this.view.height) return;
    this.view = view;
    this.scale.setGameSize(Math.round(view.width * this.res), Math.round(view.height * this.res));
    this.cameras.main.centerOn(W / 2, H / 2);
    this.visuals.resizeTerrain(view);
  }

  // ---------------------------------------------------------------- input

  private worldPoint(pointer: Phaser.Input.Pointer) {
    const point = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    return { x: point.x, y: point.y };
  }

  private bindInput() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const { x, y } = this.worldPoint(pointer);
      const shift = (pointer.event as MouseEvent).shiftKey;
      const c = this.controller;
      if (pointer.button === 2) {
        c.rightClick(x, y, shift, this.enemyAt(x, y));
        return;
      }
      if (pointer.button !== 0) return;
      if (c.mode === 'build') c.placeBuilding(x, y, shift);
      else if (c.mode === 'troops') c.commandArmy(x, y, this.enemyAt(x, y));
      else this.dragStart = { x, y };
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.pointerWorld = this.worldPoint(pointer);
      this.updateHover();
    });

    const finishDrag = (pointer: Phaser.Input.Pointer) => {
      const start = this.dragStart;
      this.dragStart = null;
      if (!start || pointer.button !== 0) return;
      const shift = (pointer.event as MouseEvent).shiftKey;
      this.handleSelection(start, this.worldPoint(pointer), shift);
    };
    this.input.on('pointerup', finishDrag);
    this.input.on('pointerupoutside', finishDrag);
    this.sys.game.canvas.addEventListener('pointerleave', () => this.controller.setHover(null));
  }

  /** Id of the enemy unit or building under a point, for targeted attacks. */
  private enemyAt(x: number, y: number) {
    const view = this.controller.view;
    if (!view) return undefined;
    const enemy = view.units.filter((u) => u.side !== this.controller.mySide);
    const unit = this.unitAt(enemy, x, y);
    if (unit) return unit.id;
    const building = this.buildingAt(view.buildings, x, y);
    return building && building.side !== this.controller.mySide ? building.id : undefined;
  }

  private handleSelection(start: { x: number; y: number }, end: { x: number; y: number }, additive: boolean) {
    const c = this.controller;
    const view = c.view;
    if (!view) return;
    const mine = view.units.filter((u) => u.side === c.mySide);

    if (Math.abs(end.x - start.x) > DRAG_THRESHOLD || Math.abs(end.y - start.y) > DRAG_THRESHOLD) {
      const minX = Math.min(start.x, end.x) - UNIT_RADIUS;
      const maxX = Math.max(start.x, end.x) + UNIT_RADIUS;
      const minY = Math.min(start.y, end.y) - UNIT_RADIUS;
      const maxY = Math.max(start.y, end.y) + UNIT_RADIUS;
      c.selectUnits(
        mine.filter((u) => u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY).map((u) => u.id),
        additive
      );
      return;
    }

    const unit = this.unitAt(mine, end.x, end.y);
    if (unit) {
      if (additive) c.toggleUnit(unit.id);
      else c.selectUnits([unit.id], false);
      return;
    }
    const building = this.buildingAt(view.buildings, end.x, end.y);
    if (building && building.side === c.mySide) {
      if (building.type === 'barracks') c.openBarracks(building.id);
      else if (building.type === 'castle') c.openCastle(building.id);
      return;
    }
    if (!additive) c.clearSelection();
  }

  private unitAt(units: UnitView[], x: number, y: number) {
    let best: UnitView | null = null;
    let bestDist = UNIT_RADIUS + 10;
    for (const u of units) {
      // Banners are drawn above their feet, so test around the flag too.
      const d = Math.min(Math.hypot(u.x - x, u.y - y), Math.hypot(u.x - x, u.y - 12 - y));
      if (d <= bestDist) {
        best = u;
        bestDist = d;
      }
    }
    return best;
  }

  private buildingAt(buildings: BuildingView[], x: number, y: number) {
    let best: BuildingView | null = null;
    let bestGap = 8;
    for (const b of buildings) {
      const gap = Math.min(distanceToBuilding(b, x, y), distanceToBuilding(b, x, y + BUILDING_STATS[b.type].halfHeight * 0.6));
      if (gap <= bestGap) {
        best = b;
        bestGap = gap;
      }
    }
    return best;
  }

  private updateHover() {
    const c = this.controller;
    const view = c.view;
    if (!view || c.mode === 'build') {
      c.setHover(null);
      return;
    }
    const { x, y } = this.pointerWorld;
    const unit = this.unitAt(view.units, x, y);
    if (unit) {
      const owner = unit.side === c.mySide ? 'Your' : 'Enemy';
      c.setHover(`${owner} troop · ${Math.ceil(unit.hp)} / ${unit.maxHp} HP${unit.side !== c.mySide ? ' · right-click to attack' : ''}`);
      return;
    }
    const building = this.buildingAt(view.buildings, x, y);
    if (building) {
      const stats = BUILDING_STATS[building.type];
      const mine = building.side === c.mySide;
      let text = `${mine ? 'Your' : 'Enemy'} ${stats.label} · ${Math.ceil(building.hp)} / ${building.maxHp} HP`;
      if (building.type === 'barracks' && mine) text += ` · ${building.queue} in training · click to recruit (${UNIT_STATS.soldier.cost}$)`;
      else if (!mine) text += ' · right-click to attack';
      c.setHover(text);
      return;
    }
    c.setHover(null);
  }

  // ---------------------------------------------------------------- sync

  private sync(view: MatchView, delta: number) {
    const frame = ++this.frameNo;
    const smooth = this.smoothing ? Math.min(1, delta / 90) : 1;

    const now = this.time.now;
    for (const u of view.units) {
      if (u.side === this.controller.mySide) continue;
      this.lastKnown.set(u.id, { side: u.side, type: u.type, kind: 'unit', x: u.x, y: u.y, seenAt: now });
    }
    for (const b of view.buildings) {
      if (b.side === this.controller.mySide) continue;
      this.lastKnown.set(b.id, { side: b.side, type: b.type, kind: 'building', x: b.x, y: b.y, seenAt: now });
    }

    for (const u of view.units) {
      let sprite = this.units.get(u.id);
      if (!sprite) {
        const visual = this.visuals.unit(u.type, u.side);
        const image = this.add
          .image(u.x, u.y, visual.key)
          .setOrigin(0.5, visual.anchorY)
          .setDisplaySize(visual.width, visual.height);
        sprite = { image, x: u.x, y: u.y, bob: Math.random() * 6, seen: frame };
        this.units.set(u.id, sprite);
        if (!this.firstSync) {
          image.setScale(image.scaleX * 0.2, image.scaleY * 0.2);
          this.tweens.add({ targets: image, scaleX: 1 / this.res, scaleY: 1 / this.res, duration: 220, ease: 'Back.easeOut' });
        }
      }
      sprite.seen = frame;
      sprite.x += (u.x - sprite.x) * smooth;
      sprite.y += (u.y - sprite.y) * smooth;
      if (u.moving) sprite.bob += delta * 0.02;
      const bobY = u.moving ? -Math.abs(Math.sin(sprite.bob)) * 3 : 0;
      sprite.image.setPosition(sprite.x, sprite.y + bobY);
      sprite.image.setDepth(DEPTH.entities + sprite.y / 10);
      if (!this.tweens.isTweening(sprite.image)) {
        sprite.image.setRotation(u.attacking ? Math.sin(this.time.now * 0.03) * 0.25 : 0);
      }
    }
    for (const [id, sprite] of this.units) {
      if (sprite.seen !== frame) {
        sprite.image.destroy();
        this.units.delete(id);
      }
    }

    for (const b of view.buildings) {
      let sprite = this.buildings.get(b.id);
      if (!sprite) {
        sprite = this.createBuilding(b);
        this.buildings.set(b.id, sprite);
      }
      sprite.seen = frame;
      if (b.hp < sprite.lastHp) sprite.hurtUntil = this.time.now + 140;
      sprite.lastHp = b.hp;
      if (this.time.now < sprite.hurtUntil) sprite.image.setTint(0xffb4b4);
      else sprite.image.clearTint();
      if (sprite.queue) sprite.queue.setText(b.queue > 0 ? `×${b.queue}` : '').setVisible(b.queue > 0);
    }
    for (const [id, sprite] of this.buildings) {
      if (sprite.seen !== frame) {
        sprite.image.destroy();
        sprite.queue?.destroy();
        this.buildings.delete(id);
      }
    }

    this.drawBars(view);
    this.firstSync = false;
  }

  private createBuilding(b: BuildingView): BuildingSprite {
    const visual = this.visuals.building(b.type, b.side);
    const image = this.add
      .image(b.x, b.y, visual.key)
      .setOrigin(0.5, visual.anchorY)
      .setDisplaySize(visual.width, visual.height)
      .setDepth(DEPTH.entities + (b.y + BUILDING_STATS[b.type].halfHeight) / 10);
    const queue =
      b.type === 'barracks'
        ? this.add
            .text(b.x + visual.width / 2 - 4, b.y - visual.height * visual.anchorY, '', {
              fontFamily: UI_FONT,
              fontSize: '15px',
              fontStyle: 'bold',
              color: '#111111',
              backgroundColor: '#ffe500',
              padding: { x: 5, y: 1 },
              resolution: this.res
            })
            .setDepth(DEPTH.bars)
        : null;
    if (!this.firstSync) {
      const scaleX = image.scaleX;
      const scaleY = image.scaleY;
      image.setScale(scaleX * 0.3, scaleY * 0.3);
      this.tweens.add({ targets: image, scaleX, scaleY, duration: 320, ease: 'Back.easeOut' });
    }
    return { image, queue, seen: 0, lastHp: b.hp, hurtUntil: 0 };
  }

  private drawBars(view: MatchView) {
    const g = this.bars;
    const c = this.controller;
    g.clear();
    for (const b of view.buildings) {
      const stats = BUILDING_STATS[b.type];
      const visual = this.visuals.building(b.type, b.side);
      const top = b.y - visual.height * visual.anchorY;
      if (b.hp < b.maxHp) {
        const width = Math.min(90, Math.max(44, stats.halfWidth * 1.6));
        const share = Phaser.Math.Clamp(b.hp / b.maxHp, 0, 1);
        g.fillStyle(0x111111, 0.85);
        g.fillRoundedRect(b.x - width / 2 - 2, top - 12, width + 4, 9, 4);
        g.fillStyle(share < 0.3 ? 0xff9f1c : SIDE_COLOR[b.side], 1);
        g.fillRoundedRect(b.x - width / 2, top - 10, Math.max(3, width * share), 5, 2);
      }
      if (b.type === 'barracks' && b.queue > 0) {
        const width = visual.width - 12;
        const bottom = b.y + visual.height * (1 - visual.anchorY);
        g.fillStyle(0x111111, 0.75);
        g.fillRoundedRect(b.x - width / 2, bottom + 3, width, 6, 3);
        g.fillStyle(0xffe500, 1);
        g.fillRoundedRect(b.x - width / 2 + 1, bottom + 4, (width - 2) * b.trainProgress, 4, 2);
      }
    }
    for (const u of view.units) {
      const selected = !this.replayView && u.side === c.mySide && c.selection.has(u.id);
      if (u.hp >= u.maxHp && !selected && !u.rearguard && !u.retreating) continue;
      const sprite = this.units.get(u.id);
      const ux = sprite?.x ?? u.x;
      const troop = this.visuals.unit(u.type, u.side);
      const uy = (sprite?.y ?? u.y) - troop.height * troop.anchorY - 7;
      const share = Phaser.Math.Clamp(u.hp / u.maxHp, 0, 1);

      if (u.rearguard || u.retreating) {
        const color = SIDE_COLOR[u.side];
        if (u.rearguard) {
          // Small shield marker above the HP bar. It stays deliberately abstract and map-like.
          g.fillStyle(color, 0.95);
          g.beginPath();
          g.moveTo(ux - 4, uy - 8);
          g.lineTo(ux + 4, uy - 8);
          g.lineTo(ux + 5, uy - 3);
          g.lineTo(ux, uy + 1);
          g.lineTo(ux - 5, uy - 3);
          g.closePath();
          g.fillPath();
          g.lineStyle(1.5, 0xffffff, 0.95);
          g.strokePath();
        } else {
          // Three short retreat streaks communicate movement direction without cluttering the unit glyph.
          g.lineStyle(1.8, color, 0.85);
          g.lineBetween(ux + 13, uy - 5, ux + 20, uy - 5);
          g.lineBetween(ux + 13, uy - 1, ux + 18, uy - 1);
          g.lineBetween(ux + 13, uy + 3, ux + 20, uy + 3);
        }
      }

      g.fillStyle(0x111111, 0.85);
      g.fillRect(ux - 12, uy, 24, 5);
      g.fillStyle(share < 0.35 ? 0xff9f1c : 0x22c55e, 1);
      g.fillRect(ux - 11, uy + 1, 22 * share, 3);
    }
  }

  private drawFog(view: MatchView) {
    const fog = this.fogTexture;
    const memory = this.fogMemory;
    if (this.replayView || !view || !this.textures.exists('fog-cloud')) {
      fog.setVisible(false);
      memory.clear();
      return;
    }

    fog.setVisible(true);
    fog.clear();

    const enemy = this.controller.mySide === 'blue' ? GAME_RULES.map.redLand : GAME_RULES.map.blueLand;
    const spanX = enemy.maxX - enemy.minX;
    const spanY = enemy.maxY - enemy.minY;
    const cloudLayout = [
      [0.08, 0.18, 0.76],
      [0.56, 0.16, 0.72],
      [0.92, 0.36, 0.70],
      [0.31, 0.58, 0.74],
      [0.75, 0.82, 0.72]
    ] as const;

    cloudLayout.forEach(([rx, ry, scale], i) => {
      const driftX = Math.sin(this.time.now / 9000 + i * 1.7) * 12;
      const driftY = Math.cos(this.time.now / 11_000 + i * 1.3) * 9;
      const x = enemy.minX + spanX * rx + driftX;
      const y = enemy.minY + spanY * ry + driftY;
      fog.stamp('fog-cloud', undefined, x, y, {
        scale,
        alpha: 0.96,
        rotation: Math.sin(this.time.now / 13_000 + i) * 0.025
      });
    });

    const eraser = this.fogEraser;
    eraser.clear();
    eraser.fillStyle(0xffffff, 1);
    eraser.fillPoints(territoryOutline(this.controller.mySide) as Phaser.Types.Math.Vector2Like[], true);
    eraser.fillRect(GAME_RULES.map.blueLand.maxX - 5, 0, GAME_RULES.map.redLand.minX - GAME_RULES.map.blueLand.maxX + 10, H);

    const revealSources: Array<{ x: number; y: number; radius: number }> = [];
    for (const b of view.buildings) {
      if (b.side !== this.controller.mySide || b.hp <= 0) continue;
      const radius = BUILDING_STATS[b.type].vision ?? 0;
      if (radius > 0) revealSources.push({ x: b.x, y: b.y, radius });
    }
    for (const u of view.units) {
      if (u.side !== this.controller.mySide || u.hp <= 0) continue;
      const radius = UNIT_STATS[u.type].vision;
      if (radius > 0) revealSources.push({ x: u.x, y: u.y, radius });
    }

    for (const source of revealSources) {
      const rings: Array<[number, number]> = [
        [1.08, 0.12],
        [0.96, 0.18],
        [0.82, 0.25],
        [0.66, 0.36],
        [0.48, 0.55],
        [0.24, 1]
      ];
      for (const [scale, alpha] of rings) {
        eraser.fillStyle(0xffffff, alpha);
        eraser.fillCircle(source.x, source.y, source.radius * scale);
      }
    }

    eraser.setVisible(true);
    fog.erase(eraser);
    eraser.setVisible(false);

    memory.clear();
    const visibleEnemy = new Set(view.units.filter((u) => u.side !== this.controller.mySide).map((u) => u.id));
    for (const b of view.buildings) if (b.side !== this.controller.mySide) visibleEnemy.add(b.id);

    const now = this.time.now;
    for (const [id, marker] of this.lastKnown) {
      const age = now - marker.seenAt;
      if (age >= this.fogMemoryMs) {
        this.lastKnown.delete(id);
        continue;
      }
      if (visibleEnemy.has(id)) continue;
      const alpha = 0.38 * (1 - age / this.fogMemoryMs);
      memory.lineStyle(2, 0x475569, alpha);
      if (marker.kind === 'building') {
        memory.strokeRect(marker.x - 9, marker.y - 9, 18, 18);
      } else {
        memory.strokeCircle(marker.x, marker.y, 9);
        memory.lineBetween(marker.x - 6, marker.y, marker.x + 6, marker.y);
        memory.lineBetween(marker.x, marker.y - 6, marker.x, marker.y + 6);
      }
      memory.fillStyle(0xd7dde2, Math.min(0.16, alpha * 0.5));
      memory.fillCircle(marker.x, marker.y, marker.kind === 'building' ? 3 : 2);
    }
  }

  // ---------------------------------------------------------------- overlay

  private formationCount(view: MatchView) {
    const army = view.units.filter((u) => u.side === this.controller.mySide);
    if (this.controller.fraction === 'one-third') return Math.max(1, Math.ceil(army.length / 3));
    if (this.controller.fraction === 'two-thirds') return Math.max(1, Math.ceil((army.length * 2) / 3));
    return army.length;
  }

  private drawFormationPreview(view: MatchView, x: number, y: number) {
    if (!this.formationsEnabled || this.controller.mode !== 'troops' || !this.controller.canCommand || !view.units.length) return;
    const count = this.formationCount(view);
    if (count <= 0) return;
    const army = view.units.filter((u) => u.side === this.controller.mySide);
    if (!army.length) return;
    const center = army.reduce((sum, unit) => ({ x: sum.x + unit.x / army.length, y: sum.y + unit.y / army.length }), { x: 0, y: 0 });
    const facing = Math.atan2(y - center.y, x - center.x);
    const formation = this.controller.formation;
    const offsets = formationOffsets(count, formation, FORMATION_STATS[formation].spacing, facing);
    const color = SIDE_COLOR[this.controller.mySide];
    const scale = Math.min(1, Math.max(0.7, 24 / Math.max(24, Math.sqrt(count) * 24)));

    for (const offset of offsets) {
      const px = x + offset.x;
      const py = y + offset.y;
      this.overlay.lineStyle(2, INK, 0.55);
      this.overlay.strokeCircle(px, py, 8 * scale);
      this.overlay.fillStyle(color, 0.38);
      this.overlay.fillCircle(px, py, 5.2 * scale);
    }

    this.overlay.lineStyle(2, color, 0.7);
    const formationRadius = Math.max(18, ...offsets.map((offset) => Math.hypot(offset.x, offset.y)));
    this.overlay.strokeCircle(x, y, formationRadius + 14);
  }

  private drawOverlay(view: MatchView | null) {
    const g = this.ground;
    const o = this.overlay;
    const c = this.controller;
    g.clear();
    o.clear();
    if (!view) return;

    if (!this.replayView && c.selection.size) {
      for (const [width, color, alpha] of [[6, INK, 0.6], [3, 0xffe500, 1]]) {
        g.lineStyle(width, color, alpha);
        for (const u of view.units) {
          if (!c.selection.has(u.id)) continue;
          const sprite = this.units.get(u.id);
          // A box around the unit's map symbol, which is centred on its position.
          g.strokeRoundedRect((sprite?.x ?? u.x) - 18, (sprite?.y ?? u.y) - 14, 36, 26, 4);
        }
      }
    }

    const { x, y } = this.pointerWorld;
    const cursor = this.replayView ? 'default' : c.mode === 'idle' ? 'default' : 'crosshair';
    if (this.input.manager.defaultCursor !== cursor) this.input.setDefaultCursor(cursor);

    if (!this.replayView && c.mode === 'build' && c.canCommand) {
      const territory = territoryOutline(c.mySide) as Phaser.Types.Math.Vector2Like[];
      o.fillStyle(SIDE_COLOR[c.mySide], 0.1);
      o.fillPoints(territory, true);
      o.lineStyle(2, SIDE_COLOR[c.mySide], 0.55);
      o.strokePoints(territory, true);

      const type = c.buildType;
      const stats = BUILDING_STATS[type];
      const visual = this.visuals.building(type, c.mySide);
      const point = c.placementPoint(x, y);
      const valid = c.placementCheck(point.x, point.y).ok && view.players[c.mySide].gold >= stats.cost;
      const color = valid ? 0x22c55e : 0xef4444;
      o.fillStyle(color, 0.28);
      o.lineStyle(3, color, 0.95);
      if (stats.shape === 'rect') {
        o.fillRect(point.x - stats.halfWidth, point.y - stats.halfHeight, stats.halfWidth * 2, stats.halfHeight * 2);
        o.strokeRect(point.x - stats.halfWidth, point.y - stats.halfHeight, stats.halfWidth * 2, stats.halfHeight * 2);
      } else {
        o.fillEllipse(point.x, point.y, stats.halfWidth * 2 + 12, stats.halfWidth * 2 + 12);
        o.strokeEllipse(point.x, point.y, stats.halfWidth * 2 + 12, stats.halfWidth * 2 + 12);
      }
      if (stats.attack) {
        o.lineStyle(2, INK, 0.5);
        o.strokeCircle(point.x, point.y, stats.halfWidth + UNIT_RADIUS + stats.attack.range);
      }
      this.ghost
        .setTexture(visual.key)
        .setOrigin(0.5, visual.anchorY)
        .setDisplaySize(visual.width, visual.height)
        .setPosition(point.x, point.y)
        .setAlpha(valid ? 0.8 : 0.4)
        .setVisible(true);
    } else {
      this.ghost.setVisible(false);
    }

    if (!this.replayView && c.mode === 'troops' && c.canCommand) {
      for (const [width, color, alpha] of [[6, INK, 0.6], [3, 0xffe500, 1]]) {
        o.lineStyle(width, color, alpha);
        o.strokeCircle(x, y, 18);
        o.lineBetween(x - 28, y, x - 10, y);
        o.lineBetween(x + 10, y, x + 28, y);
        o.lineBetween(x, y - 28, x, y - 10);
        o.lineBetween(x, y + 10, x, y + 28);
      }
      this.drawFormationPreview(view, x, y);
    }

    if (!this.replayView && this.dragStart && this.input.activePointer.isDown) {
      const start = this.dragStart;
      if (Math.abs(x - start.x) > DRAG_THRESHOLD || Math.abs(y - start.y) > DRAG_THRESHOLD) {
        const left = Math.min(start.x, x);
        const top = Math.min(start.y, y);
        const width = Math.abs(x - start.x);
        const height = Math.abs(y - start.y);
        o.fillStyle(0xffe500, 0.18);
        o.fillRect(left, top, width, height);
        o.lineStyle(5, INK, 0.55);
        o.strokeRect(left, top, width, height);
        o.lineStyle(2, 0xffe500, 1);
        o.strokeRect(left, top, width, height);
      }
    }
  }

  // ---------------------------------------------------------------- effects

  private playEvents(events: GameEvent[]) {
    for (const event of events) {
      if (this.effects > MAX_EFFECTS && (event.type === 'hit' || event.type === 'shot' || event.type === 'arrowShot')) continue;
      switch (event.type) {
        case 'shot':
          this.arrow(event.fromX, event.fromY, event.toX, event.toY, 0.2);
          break;
        case 'arrowShot':
          this.arrow(event.fromX, event.fromY, event.toX, event.toY, 0.85);
          break;
        case 'hit':
          this.spark(event.x + Phaser.Math.Between(-5, 5), event.y - 8 + Phaser.Math.Between(-5, 5), 0.55);
          break;
        case 'unitDied':
          this.ring(event.x, event.y - 8, SIDE_COLOR[event.side], 0.2, 0.8, 380);
          break;
        case 'unitTrained':
          this.ring(event.x, event.y, 0xffe500, 0.15, 0.6, 320);
          break;
        case 'buildingPlaced':
          this.ring(event.x, event.y, 0xffffff, 0.4, 1.6, 450);
          break;
        case 'buildingDestroyed':
          this.explosion(event.x, event.y, event.building);
          break;
      }
    }
  }

  private track(target: Phaser.GameObjects.GameObject) {
    this.effects += 1;
    target.once('destroy', () => {
      this.effects -= 1;
    });
  }

  private arrow(fromX: number, fromY: number, toX: number, toY: number, arcFactor = 0.65) {
    const image = this.add
      .image(fromX, fromY, 'arrow')
      .setScale(1 / this.res)
      .setDepth(DEPTH.arrows)
      .setRotation(Math.atan2(toY - fromY, toX - fromX));
    this.track(image);
    const motion = { t: 0 };
    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.hypot(dx, dy);
    const arc = Math.min(95, Math.max(24, distance * arcFactor));
    this.tweens.add({
      targets: motion,
      t: 1,
      duration: Math.min(520, 180 + distance * 1.15),
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const t = motion.t;
        const x = fromX + dx * t;
        const y = fromY + dy * t - Math.sin(Math.PI * t) * arc;
        const tangentX = dx;
        const tangentY = dy - Math.cos(Math.PI * t) * Math.PI * arc;
        image.setPosition(x, y).setRotation(Math.atan2(tangentY, tangentX));
      },
      onComplete: () => {
        this.spark(toX, toY - 2, 0.45);
        image.destroy();
      }
    });
  }

  private spark(x: number, y: number, scale: number) {
    const image = this.add.image(x, y, 'spark').setScale((scale * 0.6) / this.res).setDepth(DEPTH.effects);
    this.track(image);
    this.tweens.add({ targets: image, scale: (scale * 1.3) / this.res, alpha: 0, duration: 170, onComplete: () => image.destroy() });
  }

  private ring(x: number, y: number, color: number, from: number, to: number, duration: number) {
    const image = this.add.image(x, y, 'ring').setTint(color).setScale(from / this.res).setDepth(DEPTH.effects);
    this.track(image);
    this.tweens.add({ targets: image, scale: to / this.res, alpha: 0, duration, onComplete: () => image.destroy() });
  }

  private explosion(x: number, y: number, type: BuildingType) {
    const big = type === 'castle';
    const wood = type === 'fence';
    this.ring(x, y, wood ? 0x8b5a2b : 0xff9f1c, 0.3, big ? 3.2 : 1.8, big ? 700 : 500);
    this.ring(x, y, 0xffffff, 0.2, big ? 2.2 : 1.2, 400);
    for (let i = 0; i < (big ? 10 : 5); i++) {
      this.spark(x + Phaser.Math.Between(wood ? -12 : -30, wood ? 12 : 30), y + Phaser.Math.Between(wood ? -60 : -20, wood ? 60 : 20), big ? 1.4 : 0.9);
    }
    const boom = this.add
      .text(x, y - 10, wood ? '🪵' : '💥', { fontFamily: EMOJI_FONT, fontSize: big ? '72px' : '40px', resolution: this.res })
      .setOrigin(0.5)
      .setDepth(DEPTH.effects);
    this.tweens.add({ targets: boom, scale: 1.5, alpha: 0, duration: 650, onComplete: () => boom.destroy() });
    const rubble = this.add.graphics().setDepth(DEPTH.ground);
    rubble.fillStyle(0x3f3a2a, 0.35);
    rubble.fillEllipse(x, y + 6, big ? 120 : wood ? 30 : 64, big ? 54 : wood ? 130 : 22);
    this.tweens.add({ targets: rubble, alpha: 0, delay: 12_000, duration: 4000, onComplete: () => rubble.destroy() });
    if (big) this.cameras.main.shake(350, 0.006);
  }
}
