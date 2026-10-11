import { GAME_RULES, type Side } from '@arena-kingdom/shared';
import { clampCamera, type Size } from './cameraMath';

/** Stage size follows portrait screens; camera zoom supplies a readable opening view. */
export function battleView(stageWidth: number, stageHeight: number): Size {
  const { width, height } = GAME_RULES.map;
  const aspect = Math.min(2.4, Math.max(.4, stageWidth / Math.max(1, stageHeight)));
  const even = (value: number) => 2 * Math.round(value / 2);
  return { width: even(Math.max(width, height * aspect)), height: even(Math.max(height, width / aspect)) };
}

/** Distant ocean uses the stage background instead of a tall, blurry terrain raster. */
export function terrainView(view: Size): Size {
  return battleView(view.width, Math.min(view.height, view.width * .75));
}

/** Bound the actual WebGL drawing buffer, including high-DPR portrait devices. */
export function battleResolution(stage: Size, view: Size, dpr: number) {
  const preferred = Math.max(.25, stage.width * Math.min(2, Math.max(1, dpr || 1)) / view.width);
  return Math.min(2, preferred, 4096 / Math.max(view.width, view.height), Math.sqrt(4_194_304 / (view.width * view.height)));
}

export function defaultBattleCamera(view: Size, resolution: number, portrait: boolean, side: Side) {
  return clampCamera({
    x: portrait ? GAME_RULES.map.width * (side === 'blue' ? .25 : .75) : GAME_RULES.map.width / 2,
    y: GAME_RULES.map.height / 2,
    zoom: resolution * (portrait ? 2.8 : 1),
  }, { width: view.width * resolution, height: view.height * resolution }, GAME_RULES.map);
}
