import Phaser from 'phaser';
import type { ArmyFraction, MatchView, Side } from '@arena-kingdom/shared';
import type { GameController } from './GameController';
import { BATTLE_DEPTH } from './visuals';
import { COLORS } from './symbols';

export type CommandArrowKind = 'move' | 'attack';

interface CommandArrow {
  id: number;
  side: Side;
  kind: CommandArrowKind;
  from: { x: number; y: number };
  to: { x: number; y: number };
  control: { x: number; y: number };
  bornAt: number;
  expiresAt: number;
  phase: number;
}

const MAX_ARROWS = 8;
const LIFETIME_MS = 1900;
const PAPER = 0xf3e8c8;
const INK = 0x2b1d0e;
const MIN_LENGTH = 28;

function hex(value: string) {
  return Number.parseInt(value.slice(1), 16);
}

function teamColor(side: Side) {
  return hex(COLORS[side].ink);
}

function fractionIds(view: MatchView, controller: GameController): number[] {
  const units = view.units.filter((unit) => unit.side === controller.mySide);
  const fraction: ArmyFraction = controller.fraction;
  if (fraction === 'all') return units.map((unit) => unit.id);
  const count = Math.max(1, Math.ceil(units.length * (fraction === 'one-third' ? 1 / 3 : 2 / 3)));
  return units.slice(0, count).map((unit) => unit.id);
}

function centroid(view: MatchView, ids: readonly number[]) {
  const units = view.units.filter((unit) => ids.includes(unit.id));
  if (!units.length) return null;
  return units.reduce(
    (sum, unit) => ({ x: sum.x + unit.x / units.length, y: sum.y + unit.y / units.length }),
    { x: 0, y: 0 }
  );
}

function curveControl(from: { x: number; y: number }, to: { x: number; y: number }, phase: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return { x: from.x, y: from.y };
  const normalX = -dy / length;
  const normalY = dx / length;
  const bend = Math.min(105, Math.max(38, length * 0.18)) * (phase % 2 === 0 ? 1 : -1);
  return {
    x: (from.x + to.x) / 2 + normalX * bend,
    y: (from.y + to.y) / 2 + normalY * bend
  };
}

function bezier(a: { x: number; y: number }, c: { x: number; y: number }, b: { x: number; y: number }, t: number) {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y
  };
}

function tangent(a: { x: number; y: number }, c: { x: number; y: number }, b: { x: number; y: number }, t: number) {
  const u = 1 - t;
  return {
    x: 2 * (u * (c.x - a.x) + t * (b.x - c.x)),
    y: 2 * (u * (c.y - a.y) + t * (b.y - c.y))
  };
}

/**
 * Lightweight command arrows inspired by printed military map annotations.
 * This class observes only the local player's input, so enemy orders remain hidden in live play.
 */
export class CommandArrowOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly arrows: CommandArrow[] = [];
  private pointerDown: { button: number; x: number; y: number; shift: boolean } | null = null;
  private nextId = 1;
  private phase = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly controller: GameController
  ) {
    this.graphics = scene.add.graphics().setDepth(BATTLE_DEPTH.arrows);
    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('pointerupoutside', this.onPointerUp, this);
  }

  update(enabled: boolean, reducedMotion: boolean) {
    this.graphics.clear();
    if (!enabled) return;
    const now = this.scene.time.now;
    while (this.arrows.length && this.arrows[0].expiresAt <= now) this.arrows.shift();
    for (const arrow of this.arrows) this.drawArrow(arrow, now, reducedMotion);
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointerupoutside', this.onPointerUp, this);
    this.graphics.destroy();
  }

  private worldPoint(pointer: Phaser.Input.Pointer) {
    const point = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
    return { x: point.x, y: point.y };
  }

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    if (!this.controller.canCommand) return;
    if (pointer.button !== 0 && pointer.button !== 2) return;
    const mode = this.controller.mode;
    const valid = pointer.button === 0 ? mode === 'troops' : mode === 'idle' && this.controller.selection.size > 0;
    if (!valid) return;
    const point = this.worldPoint(pointer);
    this.pointerDown = {
      button: pointer.button,
      x: point.x,
      y: point.y,
      shift: Boolean((pointer.event as MouseEvent).shiftKey)
    };
  }

  private onPointerUp(pointer: Phaser.Input.Pointer) {
    const down = this.pointerDown;
    this.pointerDown = null;
    if (!down || !this.controller.canCommand) return;
    if (pointer.button !== down.button) return;

    const view = this.controller.view;
    if (!view) return;
    const end = this.worldPoint(pointer);
    const ids = down.button === 0 ? fractionIds(view, this.controller) : [...this.controller.selection];
    const from = centroid(view, ids);
    if (!from || Math.hypot(end.x - from.x, end.y - from.y) < MIN_LENGTH) return;

    const kind: CommandArrowKind = down.button === 2 && !down.shift ? 'attack' : 'move';
    this.add(from, end, kind);
  }

  private add(from: { x: number; y: number }, to: { x: number; y: number }, kind: CommandArrowKind) {
    const arrow: CommandArrow = {
      id: this.nextId++,
      side: this.controller.mySide,
      kind,
      from,
      to,
      control: curveControl(from, to, this.phase++),
      bornAt: this.scene.time.now,
      expiresAt: this.scene.time.now + LIFETIME_MS,
      phase: this.phase
    };
    this.arrows.push(arrow);
    if (this.arrows.length > MAX_ARROWS) this.arrows.splice(0, this.arrows.length - MAX_ARROWS);
  }

  private drawArrow(arrow: CommandArrow, now: number, reducedMotion: boolean) {
    const g = this.graphics;
    const lifetime = arrow.expiresAt - arrow.bornAt;
    const age = now - arrow.bornAt;
    const fade = Math.min(1, age / 160, (arrow.expiresAt - now) / 420);
    if (fade <= 0) return;
    const team = teamColor(arrow.side);
    const points: Phaser.Math.Vector2[] = [];
    const segments = 22;
    for (let i = 0; i <= segments; i++) {
      const point = bezier(arrow.from, arrow.control, arrow.to, i / segments);
      points.push(new Phaser.Math.Vector2(point.x, point.y));
    }

    g.lineStyle(10, PAPER, 0.68 * fade);
    g.strokePoints(points, false);
    g.lineStyle(4, INK, 0.72 * fade);
    g.strokePoints(points, false);
    g.lineStyle(2.5, team, 0.96 * fade);
    g.strokePoints(points, false);

    const head = bezier(arrow.from, arrow.control, arrow.to, 1);
    const t = tangent(arrow.from, arrow.control, arrow.to, 0.985);
    const angle = Math.atan2(t.y, t.x);
    const size = arrow.kind === 'attack' ? 13 : 11;
    const wing = Math.PI * 0.78;
    const left = { x: head.x - Math.cos(angle - wing) * size, y: head.y - Math.sin(angle - wing) * size };
    const right = { x: head.x - Math.cos(angle + wing) * size, y: head.y - Math.sin(angle + wing) * size };
    g.fillStyle(PAPER, 0.86 * fade);
    g.fillTriangle(head.x, head.y, left.x, left.y, right.x, right.y);
    g.fillStyle(team, 0.96 * fade);
    g.fillTriangle(head.x, head.y, left.x + Math.cos(angle) * 2, left.y + Math.sin(angle) * 2, right.x + Math.cos(angle) * 2, right.y + Math.sin(angle) * 2);

    g.fillStyle(team, 0.85 * fade);
    g.fillCircle(arrow.from.x, arrow.from.y, 4);

    if (!reducedMotion) {
      const travel = ((now - arrow.bornAt) / Math.max(1, lifetime)) % 1;
      const markerT = Math.min(0.9, 0.1 + travel * 0.72);
      const marker = bezier(arrow.from, arrow.control, arrow.to, markerT);
      g.fillStyle(PAPER, 0.75 * fade);
      g.fillCircle(marker.x, marker.y, 3.6);
      g.fillStyle(team, 0.95 * fade);
      g.fillCircle(marker.x, marker.y, 2);
    }
  }
}
