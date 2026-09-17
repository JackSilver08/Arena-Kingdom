import Phaser from 'phaser';
import {
  createInfluenceField,
  influenceContours,
  updateInfluence,
  type InfluenceContours,
  type InfluenceField,
  type MatchView,
  type Side,
  type Vec2
} from '@arena-kingdom/shared';
import { COLORS } from './symbols';
import { BATTLE_DEPTH } from './visuals';

const PAPER = 0xf3e8c8;
const GRID_SAMPLE = 40;

function hex(value: string) {
  return Number.parseInt(value.slice(1), 16);
}

function color(side: Side) {
  return hex(COLORS[side].fill);
}

function center(points: Vec2[]) {
  return points.reduce(
    (sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }),
    { x: 0, y: 0 }
  );
}

export class FrontlineOverlay {
  private readonly field: InfluenceField;
  private readonly influence: Phaser.GameObjects.Graphics;
  private readonly frontline: Phaser.GameObjects.Graphics;
  private contours: InfluenceContours = { frontLines: [], polygons: [] };
  private perfTotal = 0;
  private perfSamples = 0;
  private perfElapsed = 0;
  private enabled = true;

  constructor(private readonly scene: Phaser.Scene) {
    this.field = createInfluenceField(GRID_SAMPLE);
    this.influence = scene.add.graphics().setDepth(BATTLE_DEPTH.influence);
    this.frontline = scene.add.graphics().setDepth(BATTLE_DEPTH.frontline);
  }

  update(view: MatchView, deltaMs: number, enabled: boolean, reducedMotion: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.influence.clear();
      this.frontline.clear();
      return;
    }

    const start = performance.now();
    const changed = updateInfluence(this.field, view, deltaMs);
    if (changed) {
      this.contours = influenceContours(this.field);
      this.drawInfluenceCells();
    }
    this.drawFrontLines(reducedMotion);

    const elapsed = performance.now() - start;
    this.perfTotal += elapsed;
    this.perfSamples += 1;
    this.perfElapsed += deltaMs;
    if (this.perfElapsed >= 1000) {
      if (new URLSearchParams(window.location.search).get('perf') === '1') {
        const avg = this.perfSamples ? this.perfTotal / this.perfSamples : 0;
        console.debug(`[Arena Kingdom] influence overlay ${avg.toFixed(2)} ms/frame`);
      }
      this.perfTotal = 0;
      this.perfSamples = 0;
      this.perfElapsed = 0;
    }
  }

  destroy() {
    this.influence.destroy();
    this.frontline.destroy();
  }

  private drawInfluenceCells() {
    const g = this.influence;
    g.clear();
    for (let row = 0; row < this.field.rows - 1; row++) {
      const y = this.field.originY + row * this.field.cellSize;
      for (let col = 0; col < this.field.cols - 1; col++) {
        const i = row * this.field.cols + col;
        if (!this.field.land[i]) continue;
        const a = this.field.current[i];
        const b = this.field.current[i + 1];
        const c = this.field.current[i + this.field.cols];
        const d = this.field.current[i + this.field.cols + 1];
        const score = (a + b + c + d) / 4;
        if (Math.abs(score) < 0.05) continue;
        const side: Side = score >= 0 ? 'blue' : 'red';
        const strength = Math.min(1, Math.abs(score) / 4);
        const alpha = 0.08 + strength * 0.06;
        g.fillStyle(color(side), alpha);
        g.fillRect(this.field.originX + col * this.field.cellSize, y, this.field.cellSize + 1, this.field.cellSize + 1);
      }
    }

    for (const polygon of this.contours.polygons) {
      if (polygon.points.length < 4) continue;
      const c = center(polygon.points);
      g.fillStyle(color(polygon.side), 0.08);
      g.fillPoints(polygon.points.map((point) => new Phaser.Geom.Point(point.x, point.y)), true);
      g.fillStyle(PAPER, 0.03);
      g.fillCircle(c.x, c.y, 3);
    }
  }

  private drawFrontLines(reducedMotion: boolean) {
    const g = this.frontline;
    g.clear();
    const pulse = reducedMotion ? 0 : Math.sin(this.scene.time.now * 0.002) * 0.025;
    for (const points of this.contours.frontLines) {
      if (points.length < 3) continue;
      const side: Side = center(points).x < 960 ? 'blue' : 'red';
      const teamColor = color(side);
      const closed = Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 2;
      g.lineStyle(12, teamColor, 0.10 + pulse);
      g.strokePoints(points.map((point) => new Phaser.Geom.Point(point.x, point.y)), closed);
      g.lineStyle(5, teamColor, 0.24 + pulse);
      g.strokePoints(points.map((point) => new Phaser.Geom.Point(point.x, point.y)), closed);
      g.lineStyle(2, PAPER, 0.95);
      g.strokePoints(points.map((point) => new Phaser.Geom.Point(point.x, point.y)), closed);
    }
  }
}
