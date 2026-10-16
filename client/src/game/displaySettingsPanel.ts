import {
  loadDisplaySettings,
  saveDisplaySettings,
  type DisplaySettings,
  type MapStyle
} from './displaySettings';

const PANEL_CLASS = 'display-settings-panel';

/** Small HUD panel for client-side presentation preferences. */
export class DisplaySettingsPanel {
  private readonly root: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly panel: HTMLDivElement;
  private settings: DisplaySettings;
  private open = false;
  private readonly onChange: (settings: DisplaySettings) => void;

  constructor(battleRoot: HTMLElement, onChange: (settings: DisplaySettings) => void) {
    this.onChange = onChange;
    this.settings = loadDisplaySettings();
    this.root = document.createElement('div');
    this.root.className = 'display-settings-root';

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'display-settings-toggle';
    this.button.textContent = 'Display';
    this.button.title = 'Display settings (O)';
    this.button.setAttribute('aria-label', 'Open display settings');
    this.button.setAttribute('aria-expanded', 'false');
    this.button.setAttribute('aria-controls', 'arena-display-settings');

    this.panel = document.createElement('div');
    this.panel.className = PANEL_CLASS;
    this.panel.id = 'arena-display-settings';
    this.panel.hidden = true;
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-label', 'Display settings');
    this.panel.setAttribute('aria-modal', 'true');

    this.root.append(this.button, this.panel);
    battleRoot.append(this.root);

    this.button.addEventListener('click', () => this.toggle());
    this.render();

    const onKey = (event: KeyboardEvent) => {
      if (battleRoot.querySelector('.modal-backdrop:not([hidden])')) return;
      if (this.open && event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.close();
        return;
      }
      if (this.open && event.key === 'Tab') {
        const controls = [...this.panel.querySelectorAll<HTMLElement>('button, select, input')];
        const index = controls.indexOf(document.activeElement as HTMLElement);
        const next = event.shiftKey ? (index <= 0 ? controls.length - 1 : index - 1) : (index + 1) % controls.length;
        event.preventDefault();
        event.stopImmediatePropagation();
        controls[next]?.focus();
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (event.key.toLowerCase() === 'o') {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.toggle();
      } else if (event.key === 'Escape' && this.open) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.close();
      } else if (this.open) {
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    this.root.dataset.alive = 'true';
    (this.root as HTMLElement & { __dispose?: () => void }).__dispose = () => {
      window.removeEventListener('keydown', onKey, true);
      this.root.remove();
    };

    this.applyReducedMotionClass();
    this.onChange(this.settings);
  }

  get value() {
    return this.settings;
  }

  isOpen() {
    return this.open;
  }

  set(next: DisplaySettings) {
    this.settings = saveDisplaySettings(next);
    this.syncControls();
    this.applyReducedMotionClass();
    this.onChange(this.settings);
  }

  toggle() {
    if (this.open) this.close();
    else this.openPanel();
  }

  close() {
    this.open = false;
    this.panel.hidden = true;
    this.button.setAttribute('aria-expanded', 'false');
    this.button.focus();
  }

  destroy() {
    const dispose = (this.root as HTMLElement & { __dispose?: () => void }).__dispose;
    dispose?.();
  }

  private openPanel() {
    this.open = true;
    this.panel.hidden = false;
    this.button.setAttribute('aria-expanded', 'true');
    this.syncControls();
    this.panel.querySelector<HTMLElement>('select, input, button')?.focus();
  }

  private render() {
    this.panel.innerHTML = '';

    const heading = document.createElement('div');
    heading.className = 'display-settings-heading';
    heading.innerHTML = '<strong>Display Settings</strong>';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'display-settings-close';
    close.setAttribute('aria-label', 'Close display settings');
    close.textContent = '×';
    close.addEventListener('click', () => this.close());
    heading.append(close);

    const qualityRow = document.createElement('label');
    qualityRow.className = 'display-setting-row';
    qualityRow.innerHTML = '<span><b>Graphics quality</b><small>Texture detail and effect budget</small></span>';
    const quality = document.createElement('select');
    quality.dataset.setting = 'quality';
    quality.innerHTML = '<option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>';
    quality.addEventListener('change', () => {
      const preset = quality.value as DisplaySettings['quality'];
      this.set({ ...this.settings, quality: preset, nature: preset !== 'low', weather: preset === 'high' });
    });
    qualityRow.append(quality);

    const mapRow = document.createElement('label');
    mapRow.className = 'display-setting-row';
    mapRow.innerHTML = '<span><b>Map style</b><small>Switches the battlefield plate immediately</small></span>';
    const select = document.createElement('select');
    select.dataset.setting = 'mapStyle';
    select.innerHTML = '<option value="atlas">Medieval Tactical Atlas</option><option value="moba">Fantasy MOBA</option><option value="documentary">Documentary</option><option value="vintage">Vintage</option>';
    select.addEventListener('change', () => {
      this.set({ ...this.settings, mapStyle: select.value as MapStyle });
    });
    mapRow.append(select);

    const overlays = this.checkboxRow('In-game overlays', 'Lightweight influence/frontline overlays', 'overlays', true);
    const formations = this.checkboxRow('Formations', 'Show grouped troop markers when enabled', 'formations', false);
    const motion = this.checkboxRow('Reduced motion', 'Reduce decorative movement and pulsing', 'reducedMotion', this.settings.reducedMotion);
    const nature = this.checkboxRow('Living nature', 'Animated trees and shoreline', 'nature', this.settings.nature);
    const weather = this.checkboxRow('Weather effects', 'Cosmetic only · no change to combat or vision', 'weather', this.settings.weather);

    const note = document.createElement('p');
    note.className = 'display-settings-note';
    note.textContent = 'Settings are saved on this device. Map style changes only presentation; game state and pathfinding stay untouched.';

    this.panel.append(heading, qualityRow, mapRow, nature, weather, overlays, formations, motion, note);
    this.syncControls();
  }

  private checkboxRow(title: string, description: string, key: keyof Pick<DisplaySettings, 'overlays' | 'formations' | 'reducedMotion' | 'nature' | 'weather'>, checked: boolean) {
    const row = document.createElement('label');
    row.className = 'display-setting-row display-setting-check';
    const text = document.createElement('span');
    text.innerHTML = `<b>${title}</b><small>${description}</small>`;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.setting = key;
    input.checked = checked;
    input.addEventListener('change', () => {
      this.set({ ...this.settings, [key]: input.checked });
    });
    row.append(text, input);
    return row;
  }

  private syncControls() {
    // Visible proof of the active skin, rather than an ambiguous Display label.
    this.button.textContent = this.settings.mapStyle === 'atlas' ? 'ATLAS' : 'DISPLAY';
    this.button.title = `Current map: ${this.settings.mapStyle} (O)`;
    this.root.closest('.battle')?.setAttribute('data-map-style', this.settings.mapStyle);
    const style = this.panel.querySelector<HTMLSelectElement>('[data-setting="mapStyle"]');
    if (style) style.value = this.settings.mapStyle;
    const quality = this.panel.querySelector<HTMLSelectElement>('[data-setting="quality"]');
    if (quality) quality.value = this.settings.quality;
    for (const key of ['overlays', 'formations', 'reducedMotion', 'nature', 'weather'] as const) {
      const input = this.panel.querySelector<HTMLInputElement>(`[data-setting="${key}"]`);
      if (input) input.checked = this.settings[key];
    }
  }

  private applyReducedMotionClass() {
    this.root.closest('.battle')?.classList.toggle('reduced-motion', this.settings.reducedMotion);
  }
}
