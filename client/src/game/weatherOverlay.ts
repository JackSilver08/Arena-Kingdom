import Phaser from "phaser";
import {
  GAME_RULES,
  WEATHER_CONFIGS,
  weatherAtTime,
  type WeatherType,
} from "@arena-kingdom/shared";
import { BATTLE_DEPTH } from "./visuals";
import type { PresentationQuality } from "./presentationVisibility";

const { width: W, height: H } = GAME_RULES.map;

interface RainDrop {
  x: number;
  y: number;
  len: number;
  speed: number;
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
 * Cosmetic weather only. Sparse rain/wind and restrained mood; never changes visibility.
 */
export class WeatherOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private currentWeather: WeatherType = "fair";
  private quality: PresentationQuality = "medium";
  private enabled = true;

  // Rain particles
  private readonly raindrops: RainDrop[] = [];
  // Wind lines
  private readonly windStreams: WindStream[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(BATTLE_DEPTH.overlay - 30);

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
        alpha: 0.18 + Math.random() * 0.28,
      });
    }

    // Wind streaks
    for (let i = 0; i < 35; i++) {
      this.windStreams.push({
        x: Math.random() * (W + 200) - 100,
        y: 160 + Math.random() * 740,
        len: 40 + Math.random() * 80,
        speed: 480 + Math.random() * 320,
        alpha: 0.15 + Math.random() * 0.25,
      });
    }
  }

  get weather(): WeatherType {
    return this.currentWeather;
  }

  get modifiers() {
    return WEATHER_CONFIGS[this.currentWeather];
  }

  setQuality(quality: PresentationQuality) {
    this.quality = quality;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.graphics.clear();
    }
  }

  update(matchElapsedMs: number, delta: number, reducedMotion = false) {
    if (!this.enabled) return;

    const newWeather = weatherAtTime(matchElapsedMs);
    if (newWeather !== this.currentWeather) {
      this.currentWeather = newWeather;
    }

    const g = this.graphics;
    g.clear();

    const dt = delta * 0.001;

    switch (this.currentWeather) {
      case "rain":
        this.renderRain(g, dt, reducedMotion);
        break;
      case "fog":
        this.renderFog(g, dt, reducedMotion);
        break;
      case "gale":
        this.renderGale(g, dt, reducedMotion);
        break;
      case "fair":
      default:
        this.renderFair(g);
        break;
    }
  }

  private renderRain(
    g: Phaser.GameObjects.Graphics,
    dt: number,
    reducedMotion: boolean,
  ) {
    // 1. Cool overcast paper mood wash
    g.fillStyle(0x384852, 0.14);
    g.fillRect(0, 0, W, H);

    if (reducedMotion) return;
    // 2. Slanted rain streaks (falling at angle ~65 degrees)
    const slantX = 0.42;
    const slantY = 0.91;

    g.lineStyle(1.2, 0x485864, 0.35);
    for (const drop of this.raindrops.slice(
      0,
      this.quality === "low" ? 35 : this.quality === "medium" ? 65 : 100,
    )) {
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
  }

  private renderFog(
    g: Phaser.GameObjects.Graphics,
    _dt: number,
    _reducedMotion: boolean,
  ) {
    // Weather mist is a still, very faint hue. War fog owns the visibility mask.
    g.fillStyle(0x81a0a7, 0.045);
    g.fillRect(0, 0, W, H);
  }

  private renderGale(
    g: Phaser.GameObjects.Graphics,
    dt: number,
    reducedMotion: boolean,
  ) {
    // Subtle cool-gray paper wash
    g.fillStyle(0x3e423a, 0.06);
    g.fillRect(0, 0, W, H);

    if (reducedMotion) return;
    // Fast horizontal wind streaks
    const windAngle = WEATHER_CONFIGS.gale.windAngle;
    const cosW = Math.cos(windAngle);
    const sinW = Math.sin(windAngle);

    for (const stream of this.windStreams.slice(
      0,
      this.quality === "low" ? 8 : this.quality === "medium" ? 16 : 24,
    )) {
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
  }
}
