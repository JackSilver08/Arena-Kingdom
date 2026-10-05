import Phaser from 'phaser';
import { coastSamples, type CoastSample } from '@arena-kingdom/shared';
import { BATTLE_DEPTH } from './visuals';

/**
 * Living ocean dynamics for Arena Kingdom:
 * - Animated shoreline waves that roll toward the beach and break into soft foam
 * - Pulsating shorefoam trim along the coastline
 * - Drifting oceanic swell lines in open water
 *
 * Drawn with Phaser.GameObjects.Graphics directly on top of the water layer.
 */
export class ShorelineWavesOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly samples: CoastSample[];
  private waveTimer = 0;
  private enabled = true;

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(BATTLE_DEPTH.water + 2);
    // Sample coast every ~14 pixels for smooth wave curves with minimal CPU overhead
    this.samples = coastSamples(160);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.graphics.clear();
    }
  }

  update(delta: number, reducedMotion = false) {
    if (!this.enabled) return;
    if (!reducedMotion) {
      this.waveTimer += delta * 0.001;
    }

    const g = this.graphics;
    g.clear();

    const t = this.waveTimer;
    const n = this.samples.length;

    // 1. Draw 3 rolling wave crests moving from sea toward the shore
    const waveSets = [
      { speed: 0.28, phase: 0, maxOutset: 38, stroke: 0xdde6e8, alpha: 0.42, width: 2.2 },
      { speed: 0.28, phase: 0.33, maxOutset: 38, stroke: 0xc8d7dc, alpha: 0.35, width: 1.8 },
      { speed: 0.28, phase: 0.67, maxOutset: 38, stroke: 0xeef3f4, alpha: 0.48, width: 1.5 }
    ];

    for (const wave of waveSets) {
      const progress = ((t * wave.speed + wave.phase) % 1 + 1) % 1; // 0..1
      // As progress approaches 1, wave approaches shore (outset goes from maxOutset down to 2)
      const dist = (1 - progress) * wave.maxOutset + 2;
      // Fade in as it forms in the sea, stay visible, fade out as it hits the sand
      const fade = progress < 0.2 ? progress / 0.2 : progress > 0.82 ? (1 - progress) / 0.18 : 1;
      const alpha = wave.alpha * fade;

      if (alpha <= 0.02) continue;

      g.lineStyle(wave.width, wave.stroke, alpha);
      g.beginPath();

      for (let i = 0; i <= n; i++) {
        const s = this.samples[i % n];
        const theta = (i / n) * Math.PI * 8;
        // Undulating wave wobble
        const wobble = Math.sin(theta + t * 1.8) * 3.5 + Math.cos(theta * 2 - t * 1.2) * 2;
        const totalDist = s.margin + Math.max(1, dist + wobble);
        const wx = s.x + s.nx * totalDist;
        const wy = s.y + s.ny * totalDist;

        if (i === 0) g.moveTo(wx, wy);
        else g.lineTo(wx, wy);
      }
      g.closePath();
      g.strokePath();
    }

    // 2. Shoreline foam trim right where water kisses the land
    const foamAlpha = 0.32 + 0.12 * Math.sin(t * 2.4);
    g.lineStyle(2.8, 0xf6f1e2, foamAlpha);
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const s = this.samples[i % n];
      const theta = (i / n) * Math.PI * 12;
      const foamCreep = s.margin + 1.5 + Math.sin(theta + t * 2.2) * 1.8;
      const fx = s.x + s.nx * foamCreep;
      const fy = s.y + s.ny * foamCreep;
      if (i === 0) g.moveTo(fx, fy);
      else g.lineTo(fx, fy);
    }
    g.closePath();
    g.strokePath();
  }

  destroy() {
    this.graphics.destroy();
  }
}
