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
  assert.equal(fresh.mapStyle, 'moba');
  assert.equal(fresh.quality, 'medium');
  assert.equal(fresh.reducedMotion, true);
  stored = JSON.stringify({ mapStyle: 'vintage', formations: true });
  const migrated = settings.loadDisplaySettings();
  assert.equal(migrated.mapStyle, 'vintage');
  assert.equal(migrated.quality, 'medium');
  assert.equal(migrated.nature, true);
  assert.equal(migrated.weather, false);
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
  assert.equal(events.length, 1);
  assert.equal((events[0] as CustomEvent).detail.weather, true);
});
