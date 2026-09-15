import Phaser from 'phaser';
import {
  BUILDING_STATS,
  GAME_RULES,
  UNIT_STATS,
  distanceToBuilding,
  territoryBounds,
  type BuildingType,
  type BuildingView,
  type GameEvent,
  type MatchView,
  type Side,
  type UnitView
} from '@arena-kingdom/shared';
import {
  SPRITE_ANCHOR_Y,
  SPRITE_SIZE
} from './art';
import type { GameController } from './GameController';
import { BATTLE_DEPTH, BattleVisualRenderer } from './visuals';

const { width: W, height: H } = GAME_RULES.map;
const UI_FONT = '"Segoe UI", Arial, system-ui, sans-serif';
const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
const SIDE_COLOR: Record<Side, number> = { blue: 0x3b82f6, red: 0xef4444 };
const UNIT_RADIUS = UNIT_STATS.soldier.radius;
const DRAG_THRESHOLD = 6;
const MAX_EFFECTS = 90;
const DEPTH = BATTLE_DEPTH;

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
  private res = 1;
  private smoothing = false;
  private units = new Map<number, UnitSprite>();
  private buildings = new Map<number, BuildingSprite>();
  private ground!: Phaser.GameObjects.Graphics;
  private bars!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Image;
  private frameNo = 0;
  private firstSync = true;
  private dragStart: { x: number; y: number } | null = null;
  private pointerWorld = { x: 0, y: 0 };
  private effects = 0;

  constructor() {
    super('battle');
  }

  init(data: { controller: GameController; resolution: number }) {
    this.controller = data.controller;
    this.res = data.resolution;
    this.smoothing = data.controller.session.mode === 'pvp';
    this.visuals = new BattleVisualRenderer(this, this.res, W, H);
  }

  preload() {
    this.visuals.preload();
  }

  create() {
    const camera = this.cameras.main;
    camera.setZoom(this.res);
    camera.centerOn(W / 2, H / 2);

    this.makeEffectTextures();
    this.drawWorld();
    this.ground = this.add.graphics().setDepth(DEPTH.ground);
    this.bars = this.add.graphics().setDepth(DEPTH.bars);
    this.overlay = this.add.graphics().setDepth(DEPTH.overlay);
    this.ghost = this.add
      .image(0, 0, this.visuals.building('village', this.controller.mySide).key)
      .setDepth(DEPTH.overlay)
      .setVisible(false);
    this.bindInput();
  }

  update(_time: number, delta: number) {
    const events = this.controller.tick(delta);
    const view = this.controller.view;
    if (view) this.sync(view, delta);
    this.playEvents(events);
    this.drawOverlay(view);
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
    this.game.canvas.addEventListener('pointerleave', () => this.controller.setHover(null));
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
    if (building && building.side === c.mySide && building.type === 'barracks') {
      c.recruit(1, building.id);
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
    const troopSize = SPRITE_SIZE.troop;

    for (const u of view.units) {
      let sprite = this.units.get(u.id);
      if (!sprite) {
        const image = this.add
          .image(u.x, u.y, this.visuals.unit(u.type, u.side).key)
          .setOrigin(0.5, SPRITE_ANCHOR_Y.troop)
          .setDisplaySize(troopSize.width, troopSize.height);
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
    const size = SPRITE_SIZE[b.type];
    const image = this.add
      .image(b.x, b.y, this.visuals.building(b.type, b.side).key)
      .setOrigin(0.5, SPRITE_ANCHOR_Y[b.type])
      .setDisplaySize(size.width, size.height)
      .setDepth(DEPTH.entities + (b.y + BUILDING_STATS[b.type].halfHeight) / 10);
    const queue =
      b.type === 'barracks'
        ? this.add
            .text(b.x + size.width / 2 - 4, b.y - size.height * SPRITE_ANCHOR_Y.barracks, '', {
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
      const size = SPRITE_SIZE[b.type];
      const top = b.y - size.height * SPRITE_ANCHOR_Y[b.type];
      if (b.hp < b.maxHp) {
        const width = Math.min(90, Math.max(44, stats.halfWidth * 1.6));
        const share = Phaser.Math.Clamp(b.hp / b.maxHp, 0, 1);
        g.fillStyle(0x111111, 0.85);
        g.fillRoundedRect(b.x - width / 2 - 2, top - 12, width + 4, 9, 4);
        g.fillStyle(share < 0.3 ? 0xff9f1c : SIDE_COLOR[b.side], 1);
        g.fillRoundedRect(b.x - width / 2, top - 10, Math.max(3, width * share), 5, 2);
      }
      if (b.type === 'barracks' && b.queue > 0) {
        const width = size.width - 12;
        g.fillStyle(0x111111, 0.75);
        g.fillRoundedRect(b.x - width / 2, b.y + size.height * (1 - SPRITE_ANCHOR_Y.barracks) + 3, width, 6, 3);
        g.fillStyle(0xffe500, 1);
        g.fillRoundedRect(b.x - width / 2 + 1, b.y + size.height * (1 - SPRITE_ANCHOR_Y.barracks) + 4, (width - 2) * b.trainProgress, 4, 2);
      }
    }
    for (const u of view.units) {
      const selected = u.side === c.mySide && c.selection.has(u.id);
      if (u.hp >= u.maxHp && !selected) continue;
      const sprite = this.units.get(u.id);
      const ux = sprite?.x ?? u.x;
      const uy = (sprite?.y ?? u.y) - SPRITE_SIZE.troop.height * SPRITE_ANCHOR_Y.troop - 7;
      const share = Phaser.Math.Clamp(u.hp / u.maxHp, 0, 1);
      g.fillStyle(0x111111, 0.85);
      g.fillRect(ux - 12, uy, 24, 5);
      g.fillStyle(share < 0.35 ? 0xff9f1c : 0x22c55e, 1);
      g.fillRect(ux - 11, uy + 1, 22 * share, 3);
    }
  }

  // ---------------------------------------------------------------- overlay

  private drawOverlay(view: MatchView | null) {
    const g = this.ground;
    const o = this.overlay;
    const c = this.controller;
    g.clear();
    o.clear();
    if (!view) return;

    // Soft shadows ground the sprites on the grass.
    g.fillStyle(0x000000, 0.14);
    for (const b of view.buildings) {
      const stats = BUILDING_STATS[b.type];
      const size = SPRITE_SIZE[b.type];
      const baseY = b.y + size.height * (1 - SPRITE_ANCHOR_Y[b.type]) - 4;
      g.fillEllipse(b.x, baseY, stats.shape === 'rect' ? size.width + 6 : size.width * 0.9, 14);
    }
    for (const u of view.units) {
      const sprite = this.units.get(u.id);
      g.fillEllipse(sprite?.x ?? u.x, (sprite?.y ?? u.y) + 9, 22, 8);
    }

    if (c.selection.size) {
      g.lineStyle(3, 0xffe500, 1);
      for (const u of view.units) {
        if (!c.selection.has(u.id)) continue;
        const sprite = this.units.get(u.id);
        g.strokeEllipse(sprite?.x ?? u.x, (sprite?.y ?? u.y) + 9, 32, 14);
      }
    }

    const { x, y } = this.pointerWorld;
    const cursor = c.mode === 'idle' ? 'default' : 'crosshair';
    if (this.input.manager.defaultCursor !== cursor) this.input.setDefaultCursor(cursor);

    if (c.mode === 'build' && c.canCommand) {
      const bounds = territoryBounds(c.mySide);
      o.fillStyle(0xffffff, 0.12);
      o.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

      const type = c.buildType;
      const stats = BUILDING_STATS[type];
      const size = SPRITE_SIZE[type];
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
        o.lineStyle(2, 0xffffff, 0.6);
        o.strokeCircle(point.x, point.y, stats.halfWidth + UNIT_RADIUS + stats.attack.range);
      }
      this.ghost
        .setTexture(this.visuals.building(type, c.mySide).key)
        .setOrigin(0.5, SPRITE_ANCHOR_Y[type])
        .setDisplaySize(size.width, size.height)
        .setPosition(point.x, point.y)
        .setAlpha(valid ? 0.8 : 0.4)
        .setVisible(true);
    } else {
      this.ghost.setVisible(false);
    }

    if (c.mode === 'troops' && c.canCommand) {
      o.lineStyle(3, 0xffe500, 1);
      o.strokeCircle(x, y, 18);
      o.lineBetween(x - 28, y, x - 10, y);
      o.lineBetween(x + 10, y, x + 28, y);
      o.lineBetween(x, y - 28, x, y - 10);
      o.lineBetween(x, y + 10, x, y + 28);
    }

    if (this.dragStart && this.input.activePointer.isDown) {
      const start = this.dragStart;
      if (Math.abs(x - start.x) > DRAG_THRESHOLD || Math.abs(y - start.y) > DRAG_THRESHOLD) {
        o.fillStyle(0xffe500, 0.14);
        o.fillRect(Math.min(start.x, x), Math.min(start.y, y), Math.abs(x - start.x), Math.abs(y - start.y));
        o.lineStyle(2, 0xffe500, 1);
        o.strokeRect(Math.min(start.x, x), Math.min(start.y, y), Math.abs(x - start.x), Math.abs(y - start.y));
      }
    }
  }

  // ---------------------------------------------------------------- effects

  private playEvents(events: GameEvent[]) {
    for (const event of events) {
      if (this.effects > MAX_EFFECTS && (event.type === 'hit' || event.type === 'shot')) continue;
      switch (event.type) {
        case 'shot':
          this.arrow(event.fromX, event.fromY, event.toX, event.toY);
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

  private arrow(fromX: number, fromY: number, toX: number, toY: number) {
    const image = this.add
      .image(fromX, fromY, 'arrow')
      .setScale(1 / this.res)
      .setDepth(DEPTH.effects)
      .setRotation(Math.atan2(toY - fromY, toX - fromX));
    this.track(image);
    this.tweens.add({
      targets: image,
      x: toX,
      y: toY - 8,
      duration: Math.min(260, 80 + Math.hypot(toX - fromX, toY - fromY)),
      onComplete: () => {
        this.spark(toX, toY - 8, 0.45);
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
