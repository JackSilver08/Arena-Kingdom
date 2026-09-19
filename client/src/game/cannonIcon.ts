/** Canonical Cannon recruitment and battlefield asset from the approved reference image. */
const CANNON_ASSET_URL = new URL('./cannon.webp', import.meta.url).href;

export function cannonIconDataUrl(_side: 'blue' | 'red') {
  return CANNON_ASSET_URL;
}
