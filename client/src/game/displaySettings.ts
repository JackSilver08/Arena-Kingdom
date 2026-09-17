export type MapStyle = 'documentary' | 'vintage';
export interface DisplaySettings {
  mapStyle: MapStyle;
  overlays: boolean;
  formations: boolean;
  reducedMotion: boolean;
}

const STORAGE_KEY = 'arena-kingdom.display-settings';
export const DISPLAY_SETTINGS_EVENT = 'arena-kingdom:display-settings';

const prefersReducedMotion = () => {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
};

export const DEFAULT_DISPLAY_SETTINGS: Readonly<DisplaySettings> = {
  mapStyle: 'documentary',
  overlays: true,
  formations: false,
  reducedMotion: prefersReducedMotion()
};

function isMapStyle(value: unknown): value is MapStyle {
  return value === 'documentary' || value === 'vintage';
}

function normalize(value: unknown): Partial<DisplaySettings> {
  if (!value || typeof value !== 'object') return {};
  const record = value as Record<string, unknown>;
  return {
    ...(isMapStyle(record.mapStyle) ? { mapStyle: record.mapStyle } : {}),
    ...(typeof record.overlays === 'boolean' ? { overlays: record.overlays } : {}),
    ...(typeof record.formations === 'boolean' ? { formations: record.formations } : {}),
    ...(typeof record.reducedMotion === 'boolean' ? { reducedMotion: record.reducedMotion } : {})
  };
}

export function loadDisplaySettings(): DisplaySettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DISPLAY_SETTINGS };
    return { ...DEFAULT_DISPLAY_SETTINGS, ...normalize(JSON.parse(raw)) };
  } catch {
    return { ...DEFAULT_DISPLAY_SETTINGS };
  }
}

export function saveDisplaySettings(settings: DisplaySettings): DisplaySettings {
  const next = { ...DEFAULT_DISPLAY_SETTINGS, ...normalize(settings) };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
