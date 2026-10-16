export type MapStyle = 'atlas' | 'documentary' | 'vintage' | 'moba';
export type GraphicsQuality = 'low' | 'medium' | 'high';
export interface DisplaySettings {
  mapStyle: MapStyle;
  quality: GraphicsQuality;
  nature: boolean;
  weather: boolean;
  overlays: boolean;
  formations: boolean;
  reducedMotion: boolean;
}

const STORAGE_KEY = 'arena-kingdom.display-settings';
/**
 * Previous builds stored an explicit old default (documentary/moba) without a
 * schema version. Migrate that one time to the newly approved Atlas skin.
 * Future explicit choices stay untouched.
 */
const STYLE_SCHEMA_VERSION = 2;
export const DISPLAY_SETTINGS_EVENT = 'arena-kingdom:display-settings';

const prefersReducedMotion = () => {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
};

export const DEFAULT_DISPLAY_SETTINGS: Readonly<DisplaySettings> = {
  mapStyle: 'atlas',
  quality: 'medium',
  nature: true,
  weather: false,
  overlays: true,
  formations: false,
  reducedMotion: prefersReducedMotion()
};

function isMapStyle(value: unknown): value is MapStyle {
  return value === 'atlas' || value === 'documentary' || value === 'vintage' || value === 'moba';
}

function normalize(value: unknown): Partial<DisplaySettings> {
  if (!value || typeof value !== 'object') return {};
  const record = value as Record<string, unknown>;
  return {
    ...(isMapStyle(record.mapStyle) ? { mapStyle: record.mapStyle } : {}),
    ...(['low', 'medium', 'high'].includes(record.quality as string) ? { quality: record.quality as GraphicsQuality } : {}),
    ...(typeof record.nature === 'boolean' ? { nature: record.nature } : {}),
    ...(typeof record.weather === 'boolean' ? { weather: record.weather } : {}),
    ...(typeof record.overlays === 'boolean' ? { overlays: record.overlays } : {}),
    ...(typeof record.formations === 'boolean' ? { formations: record.formations } : {}),
    ...(typeof record.reducedMotion === 'boolean' ? { reducedMotion: record.reducedMotion } : {})
  };
}

export function loadDisplaySettings(): DisplaySettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DISPLAY_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    const record = parsed && typeof parsed === 'object'
      ? parsed as Record<string, unknown> : {};
    const next = { ...DEFAULT_DISPLAY_SETTINGS, ...normalize(parsed) };
    if (record.styleSchemaVersion !== STYLE_SCHEMA_VERSION) {
      next.mapStyle = 'atlas';
      // Preserve quality, motion and all other preferences. Do not dispatch a
      // settings event while loading; Phaser has not initialized its scene yet.
      try {
        window.localStorage.setItem(STORAGE_KEY,
          JSON.stringify({ ...next, styleSchemaVersion: STYLE_SCHEMA_VERSION }));
      } catch { /* private mode or locked storage */ }
    }
    return next;
  } catch {
    return { ...DEFAULT_DISPLAY_SETTINGS };
  }
}

export function saveDisplaySettings(settings: DisplaySettings): DisplaySettings {
  const next = { ...DEFAULT_DISPLAY_SETTINGS, ...normalize(settings) };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, styleSchemaVersion: STYLE_SCHEMA_VERSION }));
  } catch {
    // Storage can be unavailable in private browsing or locked-down contexts.
  }
  window.dispatchEvent(new CustomEvent<DisplaySettings>(DISPLAY_SETTINGS_EVENT, { detail: next }));
  return next;
}

export function updateDisplaySettings(
  current: DisplaySettings,
  patch: Partial<DisplaySettings>
): DisplaySettings {
  return saveDisplaySettings({ ...current, ...patch });
}
