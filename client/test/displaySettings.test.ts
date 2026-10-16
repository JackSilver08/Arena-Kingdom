import assert from 'node:assert/strict';
import test from 'node:test';

let stored: string | null = null;
const events: Event[] = [];
Object.assign(globalThis, { window: {
  matchMedia: () => ({ matches: true }),
  localStorage: { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } },
  dispatchEvent: (event: Event) => { events.push(event); return true; }
} });
const settings = await import('../src/game/displaySettings');

test('new and old saved preferences receive safe quality and nature defaults', () => {
  stored = null;
  const fresh = settings.loadDisplaySettings();
  assert.equal(fresh.mapStyle, 'atlas');
  assert.equal(fresh.quality, 'medium');
  assert.equal(fresh.reducedMotion, true);
  stored = JSON.stringify({ mapStyle: 'vintage', formations: true });
  const migrated = settings.loadDisplaySettings();
  assert.equal(migrated.mapStyle, 'atlas', 'migrate old skin to the approved atlas');
  assert.equal(migrated.formations, true, 'retain unrelated preferences');
  assert.equal(migrated.quality, 'medium');
  assert.equal(migrated.nature, true);
  assert.equal(migrated.weather, false);
  assert.equal(JSON.parse(stored!).styleSchemaVersion, 2);
  stored = JSON.stringify({ mapStyle: 'moba', quality: 'high', weather: true });
  const previousMoba = settings.loadDisplaySettings();
  assert.equal(previousMoba.mapStyle, 'atlas', 'older saved MOBA default must not hide Atlas');
  assert.equal(previousMoba.quality, 'high');
  assert.equal(previousMoba.weather, true);
  const moba = settings.saveDisplaySettings({ ...previousMoba, mapStyle: 'moba' });
  assert.equal(settings.loadDisplaySettings().mapStyle, moba.mapStyle, 'new user choice persists');
  const vintage = settings.saveDisplaySettings({ ...moba, mapStyle: 'vintage' });
  assert.equal(settings.loadDisplaySettings().mapStyle, vintage.mapStyle);
});

test('malformed storage cannot enable invalid graphics presets', () => {
  stored = JSON.stringify({ quality: 'ultra', nature: 'yes', weather: 1, overlays: false });
  const value = settings.loadDisplaySettings();
  assert.equal(value.quality, 'medium');
  assert.equal(value.nature, true);
  assert.equal(value.weather, false);
  assert.equal(value.overlays, false);
  stored = '{broken';
  assert.equal(settings.loadDisplaySettings().quality, 'medium');
});

test('saved independent nature and weather preferences survive reload and publish one update', () => {
  const next = settings.saveDisplaySettings({ ...settings.DEFAULT_DISPLAY_SETTINGS,
    quality: 'low', nature: false, weather: true });
  assert.deepEqual(settings.loadDisplaySettings(), next);
  assert.equal((events.at(-1) as CustomEvent).detail.weather, true);
  assert.equal(JSON.parse(stored!).styleSchemaVersion, 2);
});
