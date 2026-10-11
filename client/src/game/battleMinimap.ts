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
    this.canvas.setAttribute("role", "img");
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
    ctx.fillStyle = "#17343d";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.scale(sx, sy);
    // Neutral land is grass too; leaving this unpainted would suggest a river on the overview.
    ctx.fillStyle = '#365044';
    ctx.beginPath();
    coastline(160).forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.closePath();
    ctx.fill();
    for (const side of ["blue", "red"] as const) {
      ctx.fillStyle = side === this.side ? "#436253" : "#365044";
      ctx.beginPath();
      territoryOutline(side).forEach((point, index) =>
        index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
      );
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#69716c";
    for (const ridge of MOUNTAIN_RIDGES) {
      ctx.beginPath();
      ctx.ellipse(ridge.cx, ridge.cy, ridge.rx, ridge.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.drawImage(fog, 0, 0, this.canvas.width, this.canvas.height);
    // Only objects present in the current perspective are plotted, after terrain fog.
    for (const building of view.buildings) {
      ctx.fillStyle = building.side === "blue" ? "#69b9ff" : "#ff7a82";
      const size = building.type === "castle" ? 7 : 4;
      ctx.fillRect(
        building.x * sx - size / 2,
        building.y * sy - size / 2,
        size,
        size,
      );
    }
    for (const unit of view.units) {
      ctx.fillStyle = unit.side === "blue" ? "#a5d6ff" : "#ff9da3";
      ctx.beginPath();
      ctx.arc(unit.x * sx, unit.y * sy, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
    const rect = cameraRect(camera, viewport, WORLD);
    ctx.strokeStyle = "#ffe7a3";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      rect.x * sx + 0.5,
      rect.y * sy + 0.5,
      Math.max(1, rect.width * sx - 1),
      Math.max(1, rect.height * sy - 1),
    );
  }

  destroy() {
    this.canvas.removeEventListener("pointerdown", this.onPointer);
    this.canvas.removeEventListener("keydown", this.onKey, true);
    this.canvas.remove();
  }
}
