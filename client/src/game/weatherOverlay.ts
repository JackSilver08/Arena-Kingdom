import Phaser from 'phaser';
import { GAME_RULES, WEATHER_CONFIGS, weatherAtTime, type WeatherType } from '@arena-kingdom/shared';
import { BATTLE_DEPTH } from './visuals';

const { width: W, height: H } = GAME_RULES.map;

interface RainDrop {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
}

interface FogPatch {
  x: number;
  y: number;
  rx: number;
  ry: number;
  speedX: number;
  alpha: number;
}

interface WindStream {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
}

/**
 * Tactical Weather Overlay for Arena Kingdom:
 * Displays dynamic rainstorms, rolling fog banks, gale winds, and atmospheric paper tints.
 */
export class WeatherOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly flashGraphics: Phaser.GameObjects.Graphics;
  private currentWeather: WeatherType = 'fair';
  private weatherElapsedMs = 0;
  private timer = 0;
  private enabled = true;

  // Rain particles
  private readonly raindrops: RainDrop[] = [];
  // Fog banks
  private readonly fogPatches: FogPatch[] = [];
  // Wind lines
  private readonly windStreams: WindStream[] = [];

  // Lightning
  private lightningTimer = 0;
  private lightningAlpha = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(BATTLE_DEPTH.effects - 10);
    this.flashGraphics = scene.add.graphics().setDepth(BATTLE_DEPTH.effects + 50);

    this.initParticles();
  }

  private initParticles() {
    // Raindrops pool
    for (let i = 0; i < 180; i++) {
      this.raindrops.push({
        x: Math.random() * (W + 200) - 100,
        y: Math.random() * (H + 100) - 50,
        len: 12 + Math.random() * 14,
        speed: 680 + Math.random() * 260,
        alpha: 0.18 + Math.random() * 0.28
      });
    }

    // Fog patches
    for (let i = 0; i < 12; i++) {
      this.fogPatches.push({
        x: Math.random() * W,
        y: 180 + Math.random() * 700,
        rx: 140 + Math.random() * 120,
        ry: 60 + Math.random() * 50,
        speedX: 12 + Math.random() * 18,
        alpha: 0.12 + Math.random() * 0.14
      });
    }

    // Wind streaks
    for (let i = 0; i < 35; i++) {
      this.windStreams.push({
        x: Math.random() * (W + 200) - 100,
        y: 160 + Math.random() * 740,
        len: 40 + Math.random() * 80,
        speed: 480 + Math.random() * 320,
        alpha: 0.15 + Math.random() * 0.25
      });
    }
  }

  get weather(): WeatherType {
    return this.currentWeather;
  }

  get modifiers() {
    return WEATHER_CONFIGS[this.currentWeather];
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.graphics.clear();
      this.flashGraphics.clear();
    }
  }

  update(matchElapsedMs: number, delta: number, reducedMotion = false) {
    if (!this.enabled) return;

    this.weatherElapsedMs = matchElapsedMs;
    const newWeather = weatherAtTime(matchElapsedMs);
    if (newWeather !== this.currentWeather) {
      this.currentWeather = newWeather;
    }

    if (!reducedMotion) {
      this.timer += delta * 0.001;
    }

    const g = this.graphics;
    const fg = this.flashGraphics;
    g.clear();
    fg.clear();

    const dt = delta * 0.001;

    switch (this.currentWeather) {
      case 'rain':
        this.renderRain(g, fg, dt, reducedMotion);
        break;
      case 'fog':
        this.renderFog(g, dt, reducedMotion);
        break;
      case 'gale':
        this.renderGale(g, dt, reducedMotion);
        break;
      case 'fair':
      default:
        this.renderFair(g);
        break;
    }
  }

  private renderRain(
    g: Phaser.GameObjects.Graphics,
    fg: Phaser.GameObjects.Graphics,
    dt: number,
    reducedMotion: boolean
  ) {
    // 1. Cool overcast paper mood wash
    g.fillStyle(0x384852, 0.14);
    g.fillRect(0, 0, W, H);

    // 2. Slanted rain streaks (falling at angle ~65 degrees)
    const slantX = 0.42;
    const slantY = 0.91;

    g.lineStyle(1.2, 0x485864, 0.35);
    for (const drop of this.raindrops) {
      if (!reducedMotion) {
        drop.x += slantX * drop.speed * dt;
        drop.y += slantY * drop.speed * dt;
        if (drop.y > H + 50 || drop.x > W + 50) {
          drop.y = -30;
          drop.x = Math.random() * (W + 200) - 100;
        }
      }

      g.lineStyle(1.1, 0x5a6c78, drop.alpha);
      g.beginPath();
      g.moveTo(drop.x, drop.y);
      g.lineTo(drop.x + slantX * drop.len, drop.y + slantY * drop.len);
      g.strokePath();
    }

    // 3. Lightning flash occasionally
    if (!reducedMotion) {
      this.lightningTimer += dt;
      if (this.lightningTimer > 9.0 && Math.random() < 0.03) {
        this.lightningTimer = 0;
        this.lightningAlpha = 0.35;
      }
      if (this.lightningAlpha > 0) {
        fg.fillStyle(0xf4faff, this.lightningAlpha);
        fg.fillRect(0, 0, W, H);
        this.lightningAlpha = Math.max(0, this.lightningAlpha - dt * 2.8);
      }
    }
  }

  private renderFog(g: Phaser.GameObjects.Graphics, dt: number, reducedMotion: boolean) {
    // Translucent soft atmospheric veil
    g.fillStyle(0xced8dc, 0.12);
    g.fillRect(0, 0, W, H);

    // Moving fog banks
    for (const patch of this.fogPatches) {
      if (!reducedMotion) {
        patch.x += patch.speedX * dt;
        if (patch.x - patch.rx > W) {
          patch.x = -patch.rx;
          patch.y = 180 + Math.random() * 700;
        }
      }

      // Soft oval fog cloud
      g.fillStyle(0xe2ebef, patch.alpha);
      g.fillEllipse(patch.x, patch.y, patch.rx * 2, patch.ry * 2);
      g.fillStyle(0xd5e1e7, patch.alpha * 0.7);
      g.fillEllipse(patch.x + 15, patch.y + 5, patch.rx * 1.5, patch.ry * 1.4);
    }
  }

  private renderGale(g: Phaser.GameObjects.Graphics, dt: number, reducedMotion: boolean) {
    // Subtle cool-gray paper wash
    g.fillStyle(0x3e423a, 0.06);
    g.fillRect(0, 0, W, H);

    // Fast horizontal wind streaks
    const windAngle = WEATHER_CONFIGS.gale.windAngle;
    const cosW = Math.cos(windAngle);
    const sinW = Math.sin(windAngle);

    for (const stream of this.windStreams) {
      if (!reducedMotion) {
        stream.x += cosW * stream.speed * dt;
        stream.y += sinW * stream.speed * dt;
        if (stream.x > W + 80 || stream.y > H + 50) {
          stream.x = -50;
          stream.y = 160 + Math.random() * 740;
        }
      }

      g.lineStyle(1.4, 0x8a9282, stream.alpha);
      g.beginPath();
      g.moveTo(stream.x, stream.y);
      g.lineTo(stream.x + cosW * stream.len, stream.y + sinW * stream.len);
      g.strokePath();
    }
  }

  private renderFair(g: Phaser.GameObjects.Graphics) {
    // Warm subtle sunlight glaze
    g.fillStyle(0xffeec2, 0.035);
    g.fillRect(0, 0, W, H);
  }

  destroy() {
    this.graphics.destroy();
    this.flashGraphics.destroy();
  }
}
