import Phaser from "phaser";
import type { MapStyle } from './displaySettings';
import {
  GAME_RULES,
  isInNeutralZone,
  territoryOutline,
  type MatchView,
  type Side,
} from "@arena-kingdom/shared";
import {
  presentationBudget,
  visibleSources,
  type PresentationQuality,
} from "./presentationVisibility";

const { width: W, height: H } = GAME_RULES.map;
/** Small canvas mask, uploaded only on the fog cadence. World entities remain engine filtered. */
export class FogOfWar {
  private readonly key: string;
  private texture: Phaser.Textures.CanvasTexture;
  private readonly image: Phaser.GameObjects.Image;
  private readonly explored = document.createElement("canvas");
  private readonly baseline = document.createElement("canvas");
  private quality: PresentationQuality = "medium";
  private lastUpdate = -Infinity;
  private mapStyle: MapStyle = 'atlas';

  setMapStyle(style: MapStyle) {
    if (this.mapStyle === style) return;
    this.mapStyle = style;
    this.lastUpdate = -Infinity;
  }

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly side: Side,
    depth: number,
  ) {
    this.key = `vision-mask-${scene.sys.settings.key}`;
    const width = Math.round(W * presentationBudget(this.quality).fogScale);
    const height = Math.round(H * presentationBudget(this.quality).fogScale);
    if (scene.textures.exists(this.key)) scene.textures.remove(this.key);
    this.texture = scene.textures.createCanvas(this.key, width, height)!;
    this.explored.width = width;
    this.explored.height = height;
    this.makeBaseline();
    this.image = scene.add
      .image(0, 0, this.key)
      .setOrigin(0)
      .setDisplaySize(W, H)
      .setDepth(depth);
  }

  get canvas() {
    return this.texture.canvas;
  }

  setQuality(quality: PresentationQuality) {
    if (quality === this.quality) return;
    const previous = document.createElement("canvas");
    previous.width = this.explored.width;
    previous.height = this.explored.height;
    previous.getContext("2d")!.drawImage(this.explored, 0, 0);
    this.quality = quality;
    const scale = presentationBudget(quality).fogScale;
    this.texture.setSize(Math.round(W * scale), Math.round(H * scale));
    this.explored.width = this.texture.width;
    this.explored.height = this.texture.height;
    this.explored
      .getContext("2d")!
      .drawImage(previous, 0, 0, this.explored.width, this.explored.height);
    this.makeBaseline();
    this.image.setDisplaySize(W, H);
    this.lastUpdate = -Infinity;
  }

  /** Replay seeks cannot inherit future discoveries or live last-known positions. */
  reset() {
    this.explored
      .getContext("2d")!
      .clearRect(0, 0, this.explored.width, this.explored.height);
    this.lastUpdate = -Infinity;
  }

  private makeBaseline() {
    this.baseline.width = this.texture.width;
    this.baseline.height = this.texture.height;
    const ctx = this.baseline.getContext("2d")!;
    const scale = this.texture.width / W;
    ctx.fillStyle = "#fff";
    ctx.save();
    ctx.scale(scale, scale);
    ctx.beginPath();
    territoryOutline(this.side).forEach((point, index) =>
      index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // The open strip excludes sea and blocked mountains, exactly as engine isInNeutralZone.
    for (let y = 0; y < this.baseline.height; y++) {
      for (
        let x = Math.floor(GAME_RULES.map.blueLand.maxX * scale);
        x <= Math.ceil(GAME_RULES.map.redLand.minX * scale);
        x++
      ) {
        if (isInNeutralZone((x + 0.5) / scale, (y + 0.5) / scale))
          ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  update(view: MatchView, now: number, force = false) {
    if (
      !force &&
      now - this.lastUpdate < presentationBudget(this.quality).fogMs
    )
      return false;
    this.lastUpdate = now;
    const ctx = this.texture.context;
    const scale = this.texture.width / W;
    ctx.clearRect(0, 0, this.texture.width, this.texture.height);
    // An ended full-information snapshot is public. Recorded earlier frames retain their fog.
    if (view.result) {
      this.texture.refresh();
      return true;
    }
    const sources = visibleSources(view, this.side);
    const reveal = (target: CanvasRenderingContext2D) => {
      target.drawImage(this.baseline, 0, 0);
      target.save();
      target.scale(scale, scale);
      target.fillStyle = "#ffffff";
      for (const source of sources) {
        target.beginPath();
        target.arc(source.x, source.y, source.radius, 0, Math.PI * 2);
        target.fill();
      }
      target.restore();
    };
    const memory = this.explored.getContext("2d")!;
    reveal(memory);
    ctx.fillStyle = this.mapStyle === 'atlas'
      ? 'rgba(55,49,39,0.80)'
      : 'rgba(3,12,22,0.88)';
    ctx.fillRect(0, 0, this.texture.width, this.texture.height);
    // Explored terrain remains muted; this texture never holds entity positions.
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = 0.3;
    ctx.drawImage(this.explored, 0, 0);
    ctx.globalAlpha = 1;
    reveal(ctx);
    ctx.globalCompositeOperation = "source-over";
    this.texture.refresh();
    return true;
  }

  destroy() {
    this.image.destroy();
    this.scene.textures.remove(this.key);
  }
}
