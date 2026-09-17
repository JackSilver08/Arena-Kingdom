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

    this.panel = document.createElement('div');
    this.panel.className = PANEL_CLASS;
    this.panel.hidden = true;
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-label', 'Display settings');

    this.root.append(this.button, this.panel);
    battleRoot.append(this.root);

    this.button.addEventListener('click', () => this.toggle());
    this.render();

    const onKey = (event: KeyboardEvent) => {
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
    this.render();
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
  }

  private render() {
    this.panel.innerHTML = '';

    const heading = document.createElement('div');
    heading.className = 'display-settings-heading';
    heading.innerHTML = '<strong>Display Settings</strong><span>O to toggle</span>';

    const mapRow = document.createElement('label');
    mapRow.className = 'display-setting-row';
    mapRow.innerHTML = '<span><b>Map style</b><small>Used by the battlefield renderer</small></span>';
    const select = document.createElement('select');
    select.dataset.setting = 'mapStyle';
    select.innerHTML = '<option value="documentary">Documentary</option><option value="vintage">Vintage</option>';
    select.addEventListener('change', () => {
      this.set({ ...this.settings, mapStyle: select.value as MapStyle });
    });
    mapRow.append(select);

    const overlays = this.checkboxRow('In-game overlays', 'Lightweight influence/frontline overlays', 'overlays', true);
    const formations = this.checkboxRow('Formations', 'Show grouped troop markers when enabled', 'formations', false);
    const motion = this.checkboxRow('Reduced motion', 'Reduce decorative movement and pulsing', 'reducedMotion', this.settings.reducedMotion);

    const note = document.createElement('p');
    note.className = 'display-settings-note';
    note.textContent = 'Settings are saved on this device. Map style will be applied by the map renderer in the next visual phase.';

    this.panel.append(heading, mapRow, overlays, formations, motion, note);
    this.syncControls();
  }

  private checkboxRow(title: string, description: string, key: keyof Pick<DisplaySettings, 'overlays' | 'formations' | 'reducedMotion'>, checked: boolean) {
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
    const style = this.panel.querySelector<HTMLSelectElement>('[data-setting="mapStyle"]');
    if (style) style.value = this.settings.mapStyle;
    for (const key of ['overlays', 'formations', 'reducedMotion'] as const) {
      const input = this.panel.querySelector<HTMLInputElement>(`[data-setting="${key}"]`);
      if (input) input.checked = this.settings[key];
    }
  }

  private applyReducedMotionClass() {
    this.root.closest('.battle')?.classList.toggle('reduced-motion', this.settings.reducedMotion);
  }
}
