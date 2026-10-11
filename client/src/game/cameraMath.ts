export interface Point {
  x: number;
  y: number;
}
export interface Size {
  width: number;
  height: number;
}
/** Centre and pixels-per-world-unit. Phaser's viewport dimensions include render resolution. */
export interface CameraState extends Point {
  zoom: number;
}
const finite = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function screenToWorld(
  point: Point,
  camera: CameraState,
  viewport: Size,
): Point {
  return {
    x: camera.x + (point.x - viewport.width / 2) / camera.zoom,
    y: camera.y + (point.y - viewport.height / 2) / camera.zoom,
  };
}

export function worldToScreen(
  point: Point,
  camera: CameraState,
  viewport: Size,
): Point {
  return {
    x: (point.x - camera.x) * camera.zoom + viewport.width / 2,
    y: (point.y - camera.y) * camera.zoom + viewport.height / 2,
  };
}

export function clampCamera(
  camera: CameraState,
  viewport: Size,
  world: Size,
): CameraState {
  const zoom = Math.max(0.001, finite(camera.zoom, 1));
  const halfW = viewport.width / (2 * zoom),
    halfH = viewport.height / (2 * zoom);
  return {
    x:
      halfW >= world.width / 2
        ? world.width / 2
        : clamp(finite(camera.x, world.width / 2), halfW, world.width - halfW),
    y:
      halfH >= world.height / 2
        ? world.height / 2
        : clamp(
            finite(camera.y, world.height / 2),
            halfH,
            world.height - halfH,
          ),
    zoom,
  };
}

export function zoomAt(
  camera: CameraState,
  factor: number,
  pointer: Point,
  viewport: Size,
  world: Size,
  limits: { min: number; max: number },
): CameraState {
  const anchor = screenToWorld(pointer, camera, viewport);
  const zoom = clamp(
    camera.zoom * (Number.isFinite(factor) && factor > 0 ? factor : 1),
    limits.min,
    limits.max,
  );
  return clampCamera(
    {
      x: anchor.x - (pointer.x - viewport.width / 2) / zoom,
      y: anchor.y - (pointer.y - viewport.height / 2) / zoom,
      zoom,
    },
    viewport,
    world,
  );
}

export function cameraRect(camera: CameraState, viewport: Size, world: Size) {
  const left = clamp(
    camera.x - viewport.width / (2 * camera.zoom),
    0,
    world.width,
  );
  const top = clamp(
    camera.y - viewport.height / (2 * camera.zoom),
    0,
    world.height,
  );
  const right = clamp(
    camera.x + viewport.width / (2 * camera.zoom),
    0,
    world.width,
  );
  const bottom = clamp(
    camera.y + viewport.height / (2 * camera.zoom),
    0,
    world.height,
  );
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function minimapPoint(point: Point, size: Size, world: Size): Point {
  return {
    x: clamp(point.x / Math.max(1, size.width), 0, 1) * world.width,
    y: clamp(point.y / Math.max(1, size.height), 0, 1) * world.height,
  };
}
