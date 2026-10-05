import Phaser from 'phaser';
import { GAME_RULES } from '@arena-kingdom/shared';
import { BATTLE_DEPTH } from './visuals';

interface ForestGrove {
  cx: number;
  cy: number;
  radius: number;
  phase: number;
  treeCount: number;
  trees: { ox: number; oy: number; r: number; color: number; stroke: number; swayScale: number }[];
}

interface DriftingLeaf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  scale: number;
  alpha: number;
  color: number;
}

const W = GAME_RULES.map.width;

/**
 * Living forest canopy overlay:
 * - Groves of medieval stylized hand-inked trees that gently sway in the wind
 * - Leaf drift particles that ride the current wind vector across the battlefield
 */
export class LivingForestOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly leafGraphics: Phaser.GameObjects.Graphics;
  private readonly groves: ForestGrove[] = [];
  private readonly leaves: DriftingLeaf[] = [];
  private timer = 0;
  private enabled = true;
  private windAngle = Math.PI * 0.15; // gently blowing east-southeast
  private windStrength = 1.0;

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(BATTLE_DEPTH.terrain + 2);
    this.leafGraphics = scene.add.graphics().setDepth(BATTLE_DEPTH.effects - 20);

    this.initGroves();
    this.initLeaves();
  }

  private initGroves() {
    // Grove anchor points (Blue half and mirrored Red half)
    const groveBases = [
      { cx: 540, cy: 230, r: 64, count: 9 },
      { cx: 620, cy: 300, r: 52, count: 7 },
      { cx: 520, cy: 820, r: 68, count: 10 },
      { cx: 640, cy: 780, r: 56, count: 8 },
      { cx: 350, cy: 380, r: 58, count: 8 },
      { cx: 340, cy: 700, r: 58, count: 8 }
    ];

    const allBases = [
      ...groveBases.map((b) => ({ ...b, mirror: false })),
      ...groveBases.map((b) => ({ ...b, cx: W - b.cx, mirror: true }))
    ];

    const treeFills = [0x788c58, 0x6e824e, 0x829562, 0x5e7240];
    const treeStrokes = [0x3c4928, 0x344022, 0x465430];

    for (const base of allBases) {
      const trees: ForestGrove['trees'] = [];
      for (let i = 0; i < base.count; i++) {
        const angle = (i / base.count) * Math.PI * 2 + (i % 2) * 0.4;
        const dist = (i === 0 ? 0 : 0.35 + (i % 3) * 0.22) * base.r;
        trees.push({
          ox: Math.cos(angle) * dist,
          oy: Math.sin(angle) * dist,
          r: 12 + (i % 4) * 3,
          color: treeFills[i % treeFills.length],
          stroke: treeStrokes[i % treeStrokes.length],
          swayScale: 0.8 + (i % 3) * 0.3
        });
      }
      this.groves.push({
        cx: base.cx,
        cy: base.cy,
        radius: base.r,
        phase: (base.cx * 0.05 + base.cy * 0.03) % (Math.PI * 2),
        treeCount: base.count,
        trees
      });
    }
  }

  private initLeaves() {
    const leafColors = [0x7b8c56, 0x937c4e, 0xa48f58, 0x5b6b3e];
    for (let i = 0; i < 28; i++) {
      this.leaves.push({
        x: Math.random() * W,
        y: 160 + Math.random() * 760,
        vx: 30 + Math.random() * 40,
        vy: 8 + Math.random() * 20,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 3,
        scale: 0.6 + Math.random() * 0.6,
        alpha: 0.35 + Math.random() * 0.4,
        color: leafColors[i % leafColors.length]
      });
    }
  }

  setWind(angle: number, strength: number) {
    this.windAngle = angle;
    this.windStrength = Math.max(0.2, Math.min(3.0, strength));
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.graphics.clear();
      this.leafGraphics.clear();
    }
  }

  update(delta: number, reducedMotion = false) {
    if (!this.enabled) return;
    if (!reducedMotion) {
      this.timer += delta * 0.001;
    }

    const t = this.timer;
    const g = this.graphics;
    g.clear();

    const cosW = Math.cos(this.windAngle);
    const sinW = Math.sin(this.windAngle);
    const strength = this.windStrength;

    // 1. Draw Groves with subtle wind sway
    for (const grove of this.groves) {
      for (const tree of grove.trees) {
        const sway = reducedMotion
          ? 0
          : Math.sin(t * 2.1 + grove.phase + tree.ox * 0.05) * 3.5 * strength * tree.swayScale;
        const swayY = reducedMotion ? 0 : Math.cos(t * 1.7 + grove.phase) * 1.5 * strength * tree.swayScale;

        const tx = grove.cx + tree.ox + cosW * sway;
        const ty = grove.cy + tree.oy + sinW * sway + swayY;

        // Soft drop shadow beneath canopy
        g.fillStyle(0x2a1c0d, 0.16);
        g.fillCircle(tx + 2.5, ty + 3.5, tree.r);

        // Canopy body
        g.fillStyle(tree.color, 0.88);
        g.lineStyle(1.2, tree.stroke, 0.9);
        g.fillCircle(tx, ty, tree.r);
        g.strokeCircle(tx, ty, tree.r);

        // Subtle vintage highlight arc
        g.lineStyle(1.0, 0xd8e4b8, 0.4);
        g.beginPath();
        g.arc(tx, ty, tree.r * 0.65, -Math.PI * 0.8, -Math.PI * 0.2);
        g.strokePath();
      }
    }

    // 2. Draw Drifting Leaves
    if (!reducedMotion) {
      const lg = this.leafGraphics;
      lg.clear();

      const dt = delta * 0.001;
      const speedMult = strength;

      for (const leaf of this.leaves) {
        leaf.x += (cosW * leaf.vx + Math.sin(t * 3 + leaf.y * 0.02) * 12) * dt * speedMult;
        leaf.y += (sinW * leaf.vy + Math.cos(t * 2 + leaf.x * 0.02) * 8) * dt * speedMult;
        leaf.rotation += leaf.vRot * dt;

        // Wrap around world edges
        if (leaf.x > W + 40) leaf.x = -20;
        if (leaf.x < -40) leaf.x = W + 20;
        if (leaf.y > 980) leaf.y = 140;
        if (leaf.y < 140) leaf.y = 960;

        // Render leaf (diamond / pointed leaf shape)
        lg.fillStyle(leaf.color, leaf.alpha);
        lg.lineStyle(0.8, 0x2e3518, leaf.alpha * 0.75);

        const cos = Math.cos(leaf.rotation) * leaf.scale;
        const sin = Math.sin(leaf.rotation) * leaf.scale;
        const p1 = { x: leaf.x - sin * 6, y: leaf.y + cos * 6 };
        const p2 = { x: leaf.x + cos * 3, y: leaf.y + sin * 3 };
        const p3 = { x: leaf.x + sin * 6, y: leaf.y - cos * 6 };
        const p4 = { x: leaf.x - cos * 3, y: leaf.y - sin * 3 };

        lg.beginPath();
        lg.moveTo(p1.x, p1.y);
        lg.lineTo(p2.x, p2.y);
        lg.lineTo(p3.x, p3.y);
        lg.lineTo(p4.x, p4.y);
        lg.closePath();
        lg.fillPath();
        lg.strokePath();
      }
    }
  }

  destroy() {
    this.graphics.destroy();
    this.leafGraphics.destroy();
  }
}
