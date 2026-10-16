import type { SymbolSize } from './symbols';

// Atlas unit cards are wider than the engine's collision circle.
// Pointer interaction and selection outline must follow what is visible.
export function pointInsideCounter(
  pointer: {x:number;y:number},
  center: {x:number;y:number},
  art: Pick<SymbolSize,'width'|'height'>,
  tolerance=2
) {
  return Math.abs(pointer.x-center.x)<=art.width/2+tolerance
    && Math.abs(pointer.y-center.y)<=art.height/2+tolerance;
}

export function counterOutline(
  center: {x:number;y:number},
  art: Pick<SymbolSize,'width'|'height'>,
  margin=3.5
) {
  const width=art.width+margin*2, height=art.height+margin*2;
  return {x:center.x-width/2,y:center.y-height/2,width,height};
}
