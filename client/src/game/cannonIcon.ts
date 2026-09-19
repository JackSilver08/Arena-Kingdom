/** Canonical Cannon art. Use a real Vite asset URL instead of a fragile embedded data blob. */
const CANNON_ASSET_URL = new URL('./cannon.svg', import.meta.url).href;

export function cannonIconDataUrl(_side: 'blue' | 'red') {
  return CANNON_ASSET_URL;
}
