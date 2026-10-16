import {
  GAME_RULES,
  MOUNTAIN_RIDGES,
  territoryOutline,
  coastline,
  type MatchView,
  type Side,
} from "@arena-kingdom/shared";
import {
  cameraRect,
  minimapPoint,
  type CameraState,
  type Size,
} from "./cameraMath";

import { DISPLAY_SETTINGS_EVENT, loadDisplaySettings, type MapStyle, type DisplaySettings } from './displaySettings';
import { CAMPAIGN_INK, campaignMinimapPalette } from './campaignPresentation';

const WORLD = GAME_RULES.map;
/** Receives exactly the currently rendered view; has no session/state access. */
export class BattleMinimap {
  readonly canvas = document.createElement("canvas");
  private camera: CameraState = {
    x: WORLD.width / 2,
    y: WORLD.height / 2,
    zoom: 1,
  };
  private readonly ctx: CanvasRenderingContext2D;
  private readonly onPointer: (event: PointerEvent) => void;
  private readonly onKey: (event: KeyboardEvent) => void;
  private style: MapStyle = loadDisplaySettings().mapStyle;
  private readonly onSettings = (event: Event) => {
    const next = (event as CustomEvent<DisplaySettings>).detail;
    if (next) this.style = next.mapStyle;
  };

  constructor(
    host: HTMLElement,
    private readonly side: Side,
    focus: (x: number, y: number) => void,
  ) {
    this.canvas.width = 240;
    this.canvas.height = 135;
    this.canvas.className = "battle-minimap-canvas";
    this.canvas.style.cssText =
      "display:block;width:100%;height:auto;aspect-ratio:16/9;touch-action:none;cursor:crosshair;border:1px solid #b69a62;border-radius:6px;";
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute("role", "button");
    this.canvas.setAttribute(
      "aria-label",
      "Battle minimap. Click to move camera; arrow keys pan camera.",
    );
    this.ctx = this.canvas.getContext("2d")!;
    this.onPointer = (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const box = this.canvas.getBoundingClientRect();
      const point = minimapPoint(
        { x: event.clientX - box.left, y: event.clientY - box.top },
        box,
        WORLD,
      );
      focus(point.x, point.y);
    };
    this.onKey = (event) => {
      const direction = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }[event.key];
      if (!direction) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      focus(
        this.camera.x + direction[0] * 100,
        this.camera.y + direction[1] * 100,
      );
    };
    window.addEventListener(DISPLAY_SETTINGS_EVENT, this.onSettings);
    this.canvas.addEventListener("pointerdown", this.onPointer);
    this.canvas.addEventListener("keydown", this.onKey, true);
    host.append(this.canvas);
  }

  update(
    view: MatchView,
    camera: CameraState,
    viewport: Size,
    fog: HTMLCanvasElement,
  ) {
    this.camera = camera;
    const ctx = this.ctx;
    const sx = this.canvas.width / WORLD.width,
      sy = this.canvas.height / WORLD.height;
    const colors = campaignMinimapPalette(this.style);
    const atlas = this.style === 'atlas';
    ctx.fillStyle = colors.sea;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.scale(sx, sy);
    // Neutral land is grass too; leaving this unpainted would suggest a river on the overview.
    ctx.fillStyle = colors.land;
    ctx.beginPath();
    coastline(160).forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.closePath();
    ctx.fill();
    if (atlas) {
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 7;
      ctx.stroke();
    }
    for (const side of ["blue", "red"] as const) {
      ctx.fillStyle = side === this.side ? colors.own : colors.enemy;
      ctx.beginPath();
      territoryOutline(side).forEach((point, index) =>
        index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
      );
      ctx.closePath();
      ctx.fill();
      if (atlas) {
        ctx.strokeStyle = side === 'blue' ? colors.blue : colors.red;
        ctx.lineWidth = 7;
        ctx.globalAlpha = .7;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = colors.ridge;
    for (const ridge of MOUNTAIN_RIDGES) {
      ctx.beginPath();
      ctx.ellipse(ridge.cx, ridge.cy, ridge.rx, ridge.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      if (atlas) {
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = CAMPAIGN_INK.ink;
        ctx.lineWidth = 3;
        ctx.globalAlpha = .45;
        const span = ridge.rx + ridge.ry;
        for (let x = -span; x <= span; x += 17) {
          ctx.beginPath();
          ctx.moveTo(ridge.cx + x - ridge.ry, ridge.cy + ridge.ry);
          ctx.lineTo(ridge.cx + x + ridge.ry, ridge.cy - ridge.ry);
          ctx.stroke();
        }
        ctx.restore();
        ctx.beginPath();
        ctx.ellipse(ridge.cx, ridge.cy, ridge.rx, ridge.ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = colors.ink;
        ctx.lineWidth = 5;
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.drawImage(fog, 0, 0, this.canvas.width, this.canvas.height);
    // Only objects present in the current perspective are plotted, after terrain fog.
    for (const building of view.buildings) {
      ctx.fillStyle = building.side === 'blue' ? colors.blue : colors.red;
      const size = building.type === 'castle' ? 7 : 4;
      const px = building.x * sx, py = building.y * sy;
      if (atlas) {
        ctx.strokeStyle = colors.ink;
        ctx.lineWidth = .8;
        ctx.fillRect(px - size/2, py - size/2, size, size);
        ctx.strokeRect(px - size/2, py - size/2, size, size);
        if (building.type === 'castle') {
          ctx.strokeStyle = colors.land;
          ctx.beginPath();ctx.moveTo(px-2,py);ctx.lineTo(px+2,py);ctx.stroke();
        }
      } else ctx.fillRect(px-size/2,py-size/2,size,size);
    }
    for (const unit of view.units) {
      ctx.fillStyle = unit.side === 'blue'
        ? (atlas ? colors.blue : '#a5d6ff')
        : (atlas ? colors.red : '#ff9da3');
      if (atlas) {
        // A counter-shaped mark, never enemy information outside the supplied view.
        ctx.fillRect(unit.x * sx - 1.9, unit.y * sy - 1.2, 3.8, 2.4);
      } else {
        ctx.beginPath();
        ctx.arc(unit.x * sx, unit.y * sy, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const rect = cameraRect(camera, viewport, WORLD);
    ctx.strokeStyle = colors.camera;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      rect.x * sx + 0.5,
      rect.y * sy + 0.5,
      Math.max(1, rect.width * sx - 1),
      Math.max(1, rect.height * sy - 1),
    );
  }

  destroy() {
    window.removeEventListener(DISPLAY_SETTINGS_EVENT, this.onSettings);
    this.canvas.removeEventListener("pointerdown", this.onPointer);
    this.canvas.removeEventListener("keydown", this.onKey, true);
    this.canvas.remove();
  }
}
