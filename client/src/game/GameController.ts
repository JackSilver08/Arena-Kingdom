import Phaser from 'phaser';
import {
  ARMY_FRACTIONS,
  BUILDABLE_TYPES,
  BUILDING_STATS,
  DIFFICULTY_LABELS,
  FORMATION_STATS,
  FORMATION_TYPES,
  GAME_RULES,
  UNIT_STATS,
  armySupplyCapacity,
  armyUpkeep,
  canPlaceBuilding,
  formationPercent,
  fractionOf,
  snapPlacement,
  type ArmyFraction,
  type BuildableType,
  type FormationType,
  type GameEvent,
  type MatchView,
  type Side,
  type UnitType
} from '@arena-kingdom/shared';
import { statComparison } from '../components/statComparison';
import { formatDuration, signed } from '../lib/format';
import { $, html, setHtml, trusted, type SafeHtml } from '../lib/html';
import { bannerIcon, buildingArt, castleArt, envelopeIcon, fallbackIcon, hammerIcon, helmetIcon, houseIcon, moneyBagIcon, unitShopArt } from './art';
import { BattleScene } from './BattleScene';
import { symbolArt } from './symbols';
import { battleView } from './visuals';
import type { GameSession, SessionSignal } from './session';

export type ControlMode = 'idle' | 'build' | 'troops';

const FRACTION_LABELS: Record<ArmyFraction, string> = { all: 'All', 'one-third': '⅓', 'two-thirds': '⅔' };
const FORMATION_KEYS: Record<FormationType, string> = { line: 'Q', column: 'W', wedge: 'E', square: 'D' };
const FORMATION_LABELS: Record<FormationType, string> = {
  line: 'Line',
  column: 'Column',
  wedge: 'V-Wedge',
  square: 'Square'
};
const HUD_INTERVAL_MS = 100;
const CASTLE_ALERT_COOLDOWN_MS = 12_000;
const END_MODAL_DELAY_MS = 1200;

interface Actions {
  lobby(): void;
  playAgain(): void;
}

function formationGlyph(type: FormationType) {
  const points: Record<FormationType, Array<[number, number]>> = {
    line: [[6, 16], [16, 16], [26, 16], [36, 16]],
    column: [[21, 4], [21, 11], [21, 18], [21, 25]],
    wedge: [[21, 5], [15, 13], [27, 13], [9, 22], [33, 22]],
    square: [[12, 8], [28, 8], [12, 22], [28, 22]]
  };
  return `<svg aria-hidden="true" viewBox="0 0 42 29" width="42" height="29" focusable="false">${points[type]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="currentColor"/>`)
    .join('')}</svg>`;
}

function typeCountsLabel(type: UnitType, count: number) {
  const symbols: Record<UnitType, string> = { soldier: '⚔', militia: '🛡', archer: '🏹', knight: '♞' };
  return `${symbols[type]} ${count}`;
}

export class GameController {
  mode: ControlMode = 'idle';
  buildType: BuildableType = 'village';
  fraction: ArmyFraction = 'all';
  formation: FormationType = 'line';
  readonly selection = new Set<number>();

  private game: Phaser.Game;
  private hudElapsed = HUD_INTERVAL_MS;
  private hudCache = new Map<string, string>();
  private contextKey = '';
  private contextBarracksId: number | null = null;
  private hoverText: string | null = null;
  private hint = '';
  private hintUntil = 0;
  private castleHp: number | null = null;
  private lastCastleAlert = -Infinity;
  private endTimer: number | null = null;
  private endShown = false;
  private surrenderArmed = false;
  private disposers: (() => void)[] = [];

  constructor(
    private readonly root: HTMLElement,
    readonly session: GameSession,
    private readonly actions: Actions
  ) {
    this.renderShell();
    const stage = $(root, '[data-canvas]');
    const view = battleView(stage.clientWidth, stage.clientHeight);
    const resolution = Math.min(2, Math.max(1, (stage.clientWidth * window.devicePixelRatio) / view.width));
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: stage,
      width: Math.round(view.width * resolution),
      height: Math.round(view.height * resolution),
      backgroundColor: '#cbb68c',
      banner: false,
      disableContextMenu: true,
      input: { keyboard: false },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true, powerPreference: 'high-performance' }
    });
    this.game.scene.add('battle', BattleScene, true, { controller: this, resolution, view });

    const onKey = (event: KeyboardEvent) => this.onKey(event);
    // Capture global command keys before focused controls (including hidden scanner inputs)
    // can consume the event.
    window.addEventListener('keydown', onKey, true);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (this.session.status === 'playing') event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    this.disposers.push(
      () => window.removeEventListener('keydown', onKey, true),
      () => window.removeEventListener('beforeunload', beforeUnload),
      this.session.on((signal) => this.onSignal(signal))
    );
    this.bindButtons();
    this.refreshHud(true);
  }

  destroy() {
    for (const dispose of this.disposers) dispose();
    if (this.endTimer !== null) window.clearTimeout(this.endTimer);
    this.game.destroy(true);
  }

  get mySide(): Side {
    return this.session.mySide;
  }

  get view(): MatchView | null {
    return this.session.view;
  }

  get canCommand() {
    return this.session.status === 'playing' && !this.view?.result;
  }

  /** Called by the scene every frame. */
  tick(deltaMs: number): GameEvent[] {
    const events = this.session.update(deltaMs);
    if (events.length) this.handleEvents(events);
    this.pruneSelection();
    this.hudElapsed += deltaMs;
    if (this.hudElapsed >= HUD_INTERVAL_MS) {
      this.hudElapsed = 0;
      this.refreshHud();
    }
    return events;
  }

  // ------------------------------------------------------------ orders

  setMode(mode: ControlMode) {
    if (mode !== 'idle' && !this.canCommand) return;
    this.contextBarracksId = null;
    this.mode = mode;
    if (mode === 'build') this.setHint('Click inside your territory to build. Shift-click to keep building. Right-click or Esc to cancel.');
    else if (mode === 'troops') this.setHint(`Choose a formation, then click a destination. ${FORMATION_LABELS[this.formation]}: ${formationPercent(FORMATION_STATS[this.formation].attackMultiplier)} attack, ${formationPercent(FORMATION_STATS[this.formation].defenseMultiplier)} defence, ${formationPercent(FORMATION_STATS[this.formation].speedMultiplier)} speed.`);
    this.refreshHud(true);
  }

  chooseBuilding(type: BuildableType) {
    this.buildType = type;
    if (this.mode !== 'build') this.setMode('build');
    else this.refreshHud(true);
  }

  chooseFraction(fraction: ArmyFraction) {
    this.fraction = fraction;
    if (this.mode !== 'troops') this.setMode('troops');
    else this.refreshHud(true);
  }

  chooseFormation(formation: FormationType) {
    if (!FORMATION_TYPES.includes(formation)) return;
    this.formation = formation;
    if (this.mode !== 'troops') this.setMode('troops');
    else this.setHint(`${FORMATION_LABELS[formation]} formation selected: ${formationPercent(FORMATION_STATS[formation].attackMultiplier)} attack, ${formationPercent(FORMATION_STATS[formation].defenseMultiplier)} defence, ${formationPercent(FORMATION_STATS[formation].speedMultiplier)} speed.`);
    this.refreshHud(true);
  }

  /** Where a building would land for a pointer position (fences snap to neighbours). */
  placementPoint(x: number, y: number) {
    const view = this.view;
    if (!view) return { x, y };
    return snapPlacement(view.buildings, this.mySide, this.buildType, Math.round(x), Math.round(y));
  }

  placementCheck(x: number, y: number) {
    const view = this.view;
    if (!view) return { ok: false, reason: '' };
    return canPlaceBuilding(view.buildings, this.mySide, this.buildType, x, y);
  }

  placeBuilding(rawX: number, rawY: number, keepBuilding: boolean) {
    if (!this.canCommand || !this.view) return;
    const stats = BUILDING_STATS[this.buildType];
    if (this.view.players[this.mySide].gold < stats.cost) {
      this.flash(`Need ${stats.cost}$ to build a ${stats.label}.`, true);
      return;
    }
    const { x, y } = this.placementPoint(rawX, rawY);
    const check = this.placementCheck(x, y);
    if (!check.ok) {
      this.flash(check.reason, true);
      return;
    }
    this.session.send({ type: 'build', building: this.buildType, x, y });
    if (!keepBuilding) this.setMode('idle');
  }

  openBarracks(barracksId: number) {
    if (!this.canCommand) return;
    const barracks = this.view?.buildings.find(
      (b) => b.id === barracksId && b.side === this.mySide && b.type === 'barracks'
    );
    if (!barracks) return;
    this.mode = 'idle';
    this.contextBarracksId = barracksId;
    this.contextKey = '';
    this.refreshHud(true);
  }

  closeContext() {
    if (this.contextBarracksId === null) return;
    this.contextBarracksId = null;
    this.contextKey = '';
    this.refreshHud(true);
  }

  tacticalFallback() {
    if (!this.canCommand) return;
    const ids = this.selection.size ? [...this.selection] : undefined;
    this.session.send({ type: 'fallback', unitIds: ids });
    this.mode = 'idle';
    this.refreshHud(true);
  }

  commandArmy(x: number, y: number, targetId?: number) {
    if (!this.canCommand) return;
    this.session.send({ type: 'army', fraction: this.fraction, x, y, targetId, formation: this.formation });
    this.setMode('idle');
  }

  rightClick(x: number, y: number, shift: boolean, targetId?: number) {
    if (this.mode !== 'idle') {
      this.setMode('idle');
      this.setHint('Order cancelled.');
      return;
    }
    if (!this.canCommand) return;
    if (!this.selection.size) {
      this.flash('Select troops first: drag a box around them, press A for the whole army, or use T.');
      return;
    }
    this.session.send({ type: 'move', unitIds: [...this.selection], x, y, attack: !shift, targetId: shift ? undefined : targetId, formation: this.formation });
  }

  recruit(count = 1, barracksId?: number, unitType: UnitType = 'soldier') {
    if (!this.canCommand) return;
    this.session.send({ type: 'train', count, barracksId, unitType });
  }

  selectUnits(ids: number[], additive: boolean) {
    this.contextBarracksId = null;
    if (!additive) this.selection.clear();
    for (const id of ids) this.selection.add(id);
    this.refreshHud(true);
  }

  toggleUnit(id: number) {
    if (this.selection.has(id)) this.selection.delete(id);
    else this.selection.add(id);
    this.refreshHud(true);
  }

  clearSelection() {
    this.contextBarracksId = null;
    if (!this.selection.size) return;
    this.selection.clear();
    this.refreshHud(true);
  }

  selectAll() {
    const view = this.view;
    if (!view) return;
    this.selectUnits(
      view.units.filter((u) => u.side === this.mySide).map((u) => u.id),
      false
    );
  }

  setHover(text: string | null) {
    this.hoverText = text;
  }

  // ------------------------------------------------------------ input

  private onKey(event: KeyboardEvent) {
    // Messenger is deliberately global. Check the physical key code first so the
    // command still works while another focusable element owns keyboard focus.
    if (!event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && event.code === 'KeyM') {
      this.toggleMessenger();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();

    if (key === 'escape') {
      if (this.closeModals()) return;
      if (this.mode !== 'idle') this.setMode('idle');
      else this.clearSelection();
      event.preventDefault();
      return;
    }

    if (this.anyModalOpen() || event.repeat) return;

    const handled = (() => {
      switch (key) {
        case 'b':
          this.setMode(this.mode === 'build' ? 'idle' : 'build');
          return true;
        case 't':
          this.setMode(this.mode === 'troops' ? 'idle' : 'troops');
          return true;
        case 'r':
          this.recruit(event.shiftKey ? 5 : 1);
          return true;
        case 'f':
          this.tacticalFallback();
          return true;
        case 'm':
          this.toggleMessenger();
          return true;
        case 'a':
          this.selectAll();
          return true;
        case 's':
          if (this.selection.size && this.canCommand) this.session.send({ type: 'stop', unitIds: [...this.selection] });
          return true;
        case 'q':
          this.chooseFormation('line');
          return true;
        case 'w':
          this.chooseFormation('column');
          return true;
        case 'e':
          this.chooseFormation('wedge');
          return true;
        case 'd':
          this.chooseFormation('square');
          return true;
        case '1':
        case '2':
        case '3':
        case '4': {
          const index = Number(key) - 1;
          if (this.mode === 'troops') {
            if (index < ARMY_FRACTIONS.length) this.chooseFraction(ARMY_FRACTIONS[index]);
          } else {
            this.chooseBuilding(BUILDABLE_TYPES[index]);
          }
          return true;
        }
        default:
          return false;
      }
    })();
    if (handled) event.preventDefault();
  }

  private bindButtons() {
    this.root.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLElement>('[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      switch (action) {
        case 'build':
          this.setMode(this.mode === 'build' ? 'idle' : 'build');
          break;
        case 'troops':
          this.setMode(this.mode === 'troops' ? 'idle' : 'troops');
          break;
        case 'fallback':
          this.tacticalFallback();
          break;
        case 'recruit':
          this.recruit(1);
          break;
        case 'recruit-unit':
          this.recruit(
            1,
            button.dataset.barracksId ? Number(button.dataset.barracksId) : undefined,
            button.dataset.unitType as UnitType
          );
          break;
        case 'close-context':
          this.closeContext();
          break;
        case 'choose-building':
          this.chooseBuilding(button.dataset.type as BuildableType);
          break;
        case 'choose-fraction':
          this.chooseFraction(button.dataset.fraction as ArmyFraction);
          break;
        case 'choose-formation':
          this.chooseFormation(button.dataset.formation as FormationType);
          break;
        case 'messenger':
          this.toggleMessenger();
          break;
        case 'close-modal':
          this.closeModals();
          break;
        case 'propose-peace':
          this.session.send({ type: 'proposePeace' });
          this.closeModals();
          break;
        case 'surrender':
          if (!this.surrenderArmed) {
            this.surrenderArmed = true;
            button.textContent = 'Click again to confirm';
            button.classList.add('armed');
          } else {
            this.session.send({ type: 'surrender' });
            this.closeModals();
          }
          break;
        case 'accept-peace':
        case 'decline-peace':
          this.session.send({ type: 'respondPeace', accept: action === 'accept-peace' });
          break;
        case 'leave':
          if (this.canCommand) this.toggleMessenger();
          else this.actions.lobby();
          break;
        case 'lobby':
          this.actions.lobby();
          break;
        case 'play-again':
          this.actions.playAgain();
          break;
        case 'hide-end':
          $(this.root, '[data-end]').hidden = true;
          $(this.root, '[data-show-end]').hidden = false;
          break;
        case 'show-end':
          $(this.root, '[data-end]').hidden = false;
          $(this.root, '[data-show-end]').hidden = true;
          break;
      }
    });
  }

  private anyModalOpen() {
    return !$(this.root, '[data-messenger]').hidden || !$(this.root, '[data-end]').hidden;
  }

  private closeModals() {
    const messenger = $(this.root, '[data-messenger]');
    if (!messenger.hidden) {
      messenger.hidden = true;
      this.refreshHud(true);
      return true;
    }
    return false;
  }

  private toggleMessenger() {
    const messenger = $(this.root, '[data-messenger]');
    if (!messenger.hidden) {
      this.closeModals();
      return;
    }
    if (!this.canCommand) return;
    this.mode = 'idle';
    this.surrenderArmed = false;
    const surrender = $(messenger, '[data-action="surrender"]');
    surrender.textContent = '🏳️ Surrender';
    surrender.classList.remove('armed');
    $<HTMLButtonElement>(messenger, '[data-action="propose-peace"]').disabled = Boolean(this.view?.peace);
    messenger.hidden = false;
    this.refreshHud(true);
  }

  // ------------------------------------------------------------ events

  private onSignal(signal: SessionSignal) {
    if (signal.type === 'notice') {
      if (signal.ok) {
        if (signal.text.startsWith('Tactical Retreat:')) this.toast(signal.text, 'info');
        this.setHint(signal.text);
      } else this.flash(signal.text, true);
    } else if (signal.type === 'end') {
      if (this.endShown) this.renderEnd();
      else if (this.endTimer === null) {
        this.mode = 'idle';
        this.endTimer = window.setTimeout(() => {
          this.endShown = true;
          this.renderEnd();
        }, END_MODAL_DELAY_MS);
      }
    } else {
      this.refreshHud(true);
    }
  }

  private handleEvents(events: GameEvent[]) {
    const me = this.mySide;
    for (const event of events) {
      switch (event.type) {
        case 'buildingDestroyed':
          if (event.building === 'castle') break;
          if (event.side === me) this.toast(`Your ${BUILDING_STATS[event.building].label} was destroyed!`, 'bad');
          else this.toast(`Enemy ${BUILDING_STATS[event.building].label} destroyed!`, 'good');
          break;
        case 'peaceProposed':
          if (event.by !== me) this.toast('✉️ The enemy proposes peace.', 'info');
          break;
        case 'peaceDeclined':
          if (event.by !== me) this.toast('The enemy rejected your peace proposal.', 'bad');
          break;
        case 'peaceExpired':
          this.toast('The peace proposal expired.', 'info');
          break;
      }
    }
  }

  private pruneSelection() {
    const view = this.view;
    if (!view || !this.selection.size) return;
    const alive = new Set<number>();
    for (const u of view.units) if (u.side === this.mySide) alive.add(u.id);
    for (const id of this.selection) if (!alive.has(id)) this.selection.delete(id);
  }

  // ------------------------------------------------------------ HUD

  private setHint(text: string) {
    this.hint = text;
    this.hintUntil = performance.now() + 4000;
    this.hudCache.delete('hint');
  }

  private flash(text: string, error = false) {
    this.setHint(error ? `⚠️ ${text}` : text);
    const hint = this.root.querySelector<HTMLElement>('[data-hud="hint"]');
    if (hint && error) {
      hint.classList.remove('shake');
      void hint.offsetWidth;
      hint.classList.add('shake');
    }
  }

  private toast(text: string, kind: 'good' | 'bad' | 'info') {
    const stack = this.root.querySelector('[data-toasts]');
    if (!stack) return;
    const item = document.createElement('div');
    item.className = `battle-toast toast-${kind}`;
    item.textContent = text;
    stack.prepend(item);
    while (stack.children.length > 4) stack.lastElementChild?.remove();
    setTimeout(() => {
      item.classList.add('leaving');
      setTimeout(() => item.remove(), 300);
    }, 3000);
  }

  private set(key: string, value: string, apply: (el: HTMLElement, value: string) => void = (el, v) => (el.textContent = v)) {
    if (this.hudCache.get(key) === value) return;
    this.hudCache.set(key, value);
    const el = this.root.querySelector<HTMLElement>(`[data-hud="${key}"]`);
    if (el) apply(el, value);
  }

  private renderShell() {
    setHtml(
      this.root,
      html`<div class="battle">
        <div class="stage-canvas" data-canvas></div>

        <div class="hud-panel hud-top-left">
          <button type="button" class="hud-back" data-action="leave" title="Leave battle" aria-label="Leave battle">←</button>
          <div class="hud-timer" data-hud="timer" title="Match time">00:00</div>
          <div class="hud-castles" data-hud="castleSide">
            <div class="castle-row mine" title="Your castle">
              <span class="castle-icon" data-hud="myCastleIcon"></span>
              <span class="castle-bar"><i data-hud="myCastle"></i></span>
            </div>
            <div class="castle-row enemy" title="Enemy castle">
              <span class="castle-icon" data-hud="enemyCastleIcon"></span>
              <span class="castle-bar"><i data-hud="enemyCastle"></i></span>
            </div>
          </div>
          <div class="hud-names">
            <b data-hud="myName"></b>
            <span data-hud="enemyName"></span>
          </div>
        </div>

        <div class="hud-panel hud-top-right">
          <div class="res" title="Gold">
            <span class="res-icon">${trusted(moneyBagIcon())}</span>
            <span class="yb res-gold"><b data-hud="gold">0</b>$<span class="income-meter"><i data-hud="incomeMeter"></i></span></span>
            <small class="res-sub" data-hud="income"></small>
          </div>
          <div class="res" title="Troops / supply capacity">
            <span class="res-icon">${trusted(bannerIcon())}</span>
            <span class="yb" data-hud="army">0 / 0</span>
            <small class="res-sub" data-hud="armySub"></small>
          </div>
          <div class="res" title="Villages">
            <span class="res-icon">${trusted(houseIcon())}</span>
            <span class="yb" data-hud="villages">0</span>
          </div>
        </div>

        <div class="hud-commands">
          <button type="button" class="cmd-btn" data-action="build" data-cmd="build" title="Build (B)">
            <span class="cmd-icon">${trusted(hammerIcon())}</span><span class="yb cmd-key">B</span>
          </button>
          <button type="button" class="cmd-btn" data-action="troops" data-cmd="troops" title="Troops (T)">
            <span class="cmd-icon">${trusted(helmetIcon())}</span><span class="yb cmd-key">T</span>
          </button>
          <button type="button" class="cmd-btn cmd-btn-fallback" data-action="fallback" data-cmd="fallback" title="Tactical Fall Back (F)">
            <span class="cmd-icon">${trusted(fallbackIcon(this.mySide))}</span><span class="yb cmd-key">F</span>
          </button>
          <button type="button" class="cmd-btn" data-action="messenger" data-cmd="messenger" title="Messenger (M)">
            <span class="cmd-icon">${trusted(envelopeIcon())}</span><span class="yb cmd-key">M</span>
          </button>
        </div>

        <div class="hud-popup" data-context hidden></div>
        <div class="hud-hint" data-hud="hint"></div>
        <div class="battle-toasts" data-toasts aria-live="polite"></div>
        <div class="stage-banner" data-hud="banner" hidden></div>
        <div class="stage-overlay" data-hud="overlay" hidden></div>
        <button type="button" class="btn-yellow show-end" data-action="show-end" data-show-end hidden>Show results</button>

        <div class="modal-backdrop" data-messenger hidden>
          <div class="modal battle-modal" role="dialog" aria-modal="true" aria-label="Messenger">
            <div class="modal-art">${trusted(envelopeIcon())}</div>
            <h2>Messenger</h2>
            <p class="muted">Diplomacy belongs on the battlefield too.</p>
            <div class="modal-actions-col">
              <button type="button" class="btn-yellow btn-block" data-action="propose-peace">🤝 Propose peace</button>
              <button type="button" class="btn-danger-light btn-block" data-action="surrender">🏳️ Surrender</button>
              <button type="button" class="btn-light btn-block" data-action="close-modal">Keep fighting</button>
            </div>
            <p class="muted small">A peace treaty ends the battle in a draw if your opponent accepts.</p>
          </div>
        </div>

        <div class="modal-backdrop" data-end hidden>
          <div class="modal battle-modal modal-wide" role="dialog" aria-modal="true" data-end-content></div>
        </div>
      </div>`
    );
  }

  private contextMarkup(view: MatchView | null): SafeHtml | null {
    const me = this.mySide;
    const gold = view?.players[me].gold ?? 0;

    if (this.contextBarracksId !== null) {
      const barracks = view?.buildings.find(
        (b) => b.id === this.contextBarracksId && b.side === me && b.type === 'barracks'
      );
      if (!barracks) return null;
      const queueLabel = barracks.queue
        ? `${barracks.queue} queued${barracks.trainType ? ` · ${UNIT_STATS[barracks.trainType].label} training` : ''}`
        : 'Queue empty';
      return html`<section class="barracks-context">
        <div class="barracks-context-head">
          <div><strong>Barracks</strong><span>${queueLabel}</span></div>
          <button type="button" class="context-close" data-action="close-context" aria-label="Close">×</button>
        </div>
        <div class="barracks-units">
          ${(['soldier', 'archer', 'knight'] as const).map(
            (unitType) => html`<button
              type="button"
              class="barracks-unit-option ${gold < UNIT_STATS[unitType].cost ? 'unaffordable' : ''}"
              data-action="recruit-unit"
              data-unit-type="${unitType}"
              data-barracks-id="${barracks.id}"
              data-cost="${UNIT_STATS[unitType].cost}"
              title="Recruit ${UNIT_STATS[unitType].label}"
            >
              <span class="barracks-unit-art">${trusted(unitShopArt(unitType, me))}</span>
              <span class="barracks-unit-copy"><b>${UNIT_STATS[unitType].label}</b><small>${UNIT_STATS[unitType].trainMs / 1000}s</small></span>
              <span class="yb option-cost">${UNIT_STATS[unitType].cost}$</span>
            </button>`
          )}
        </div>
      </section>`;
    }

    if (this.mode === 'build') {
      return html`<div class="popup-title">Build <small>keys 1-4 · Shift-click keeps building</small></div>
        <div class="popup-options">
          ${BUILDABLE_TYPES.map((type, i) => {
            const stats = BUILDING_STATS[type];
            return html`<button
              type="button"
              class="option ${this.buildType === type ? 'active' : ''} ${gold < stats.cost ? 'unaffordable' : ''}"
              data-action="choose-building"
              data-type="${type}"
              data-cost="${stats.cost}"
              title="${stats.description}"
            >
              <span class="option-key">${i + 1}</span>
              <span class="option-symbol" title="Map symbol">${trusted(symbolArt(type, me))}</span>
              <span class="option-art option-art-${type}">${trusted(buildingArt(type, me))}</span>
              <b>${stats.label}</b>
              <span class="yb option-cost">${stats.cost}$</span>
            </button>`;
          })}
        </div>
        <p class="popup-note">${BUILDING_STATS[this.buildType].description}</p>`;
    }

    if (this.mode === 'troops') {
      const army = view?.units.filter((u) => u.side === me && u.type !== 'militia') ?? [];
      const supply = view ? armySupplyCapacity(view.buildings.filter((b) => b.side === me)) : 0;
      const upkeep = armyUpkeep(army.length, supply);
      const selected = FORMATION_STATS[this.formation];
      const selectedCount = this.selection.size;
      const composition = (['soldier', 'archer', 'knight'] as UnitType[])
        .map((type) => {
          const count = army.filter((u) => u.type === type).length;
          return count ? typeCountsLabel(type, count) : '';
        })
        .filter(Boolean)
        .join('  ');

      return html`<section class="troops-deck">
        <div class="troops-deck-head">
          <div><strong>Troops</strong><span class="troops-selected">${selectedCount ? `${selectedCount} selected` : 'Select troops on the map'}</span></div>
          <div class="troops-status">Supply ${army.length}/${supply}${upkeep ? ` · −${upkeep}$/5s` : ''}</div>
        </div>
        <div class="troops-row">
          <span class="troops-label">ARMY</span>
          <div class="troops-fraction-group">
            ${ARMY_FRACTIONS.map((fraction, i) => html`<button type="button"
              class="troops-chip ${this.fraction === fraction ? 'active' : ''}" data-action="choose-fraction" data-fraction="${fraction}" title="Send ${FRACTION_LABELS[fraction]} of your army">
              <kbd>${i + 1}</kbd><b>${FRACTION_LABELS[fraction]}</b><span>${army.length ? Math.max(1, Math.ceil(army.length * fractionOf(fraction))) : 0}</span>
            </button>`)}
          </div>
          <span class="troops-composition">${composition || 'No regular troops'}</span>
        </div>
        <div class="troops-row formation-row">
          <span class="troops-label">FORMATION</span>
          <div class="formation-group">
            ${FORMATION_TYPES.map((formation) => html`<button type="button"
              class="formation-chip ${this.formation === formation ? 'active' : ''}" data-action="choose-formation" data-formation="${formation}" title="${FORMATION_STATS[formation].description}">
              <kbd>${FORMATION_KEYS[formation]}</kbd><span class="formation-glyph-compact">${trusted(formationGlyph(formation))}</span><b>${FORMATION_LABELS[formation]}</b>
            </button>`)}
          </div>
          <span class="formation-mods">${formationPercent(selected.attackMultiplier)} atk · ${formationPercent(selected.defenseMultiplier)} def · ${formationPercent(selected.speedMultiplier)} spd</span>
        </div>
        <div class="troops-footer">${selected.description}</div>
      </section>`;
    }
    return null;
  }

  private refreshHud(force = false) {
    const view = this.view;
    const s = this.session;
    const me = this.mySide;
    const enemy = s.enemySide;
    if (force) this.hudElapsed = 0;

    const army = view ? view.units.filter((u) => u.side === me).length : 0;
    const supply = view ? armySupplyCapacity(view.buildings.filter((b) => b.side === me)) : 0;
    const upkeep = armyUpkeep(army, supply);
    const contextKey = `${me}|${this.mode}|${this.buildType}|${this.fraction}|${this.formation}|${this.contextBarracksId ?? '-'}|${this.mode === 'troops' ? `${army}|${supply}|${upkeep}|${this.selection.size}` : ''}`;
    if (contextKey !== this.contextKey) {
      this.contextKey = contextKey;
      const popup = $(this.root, '[data-context]');
      const markup = this.contextMarkup(view);
      popup.hidden = !markup;
      popup.dataset.mode = this.contextBarracksId !== null ? 'recruit' : this.mode;
      if (markup) setHtml(popup, markup);
    }
    const messengerOpen = !$(this.root, '[data-messenger]').hidden;
    this.root.querySelectorAll<HTMLElement>('[data-cmd]').forEach((el) => {
      el.classList.toggle('active', el.dataset.cmd === this.mode || (el.dataset.cmd === 'messenger' && messengerOpen));
    });

    this.set('castleSide', me, (el, side) => {
      el.dataset.side = side;
    });
    this.set('myCastleIcon', me, (el, side) => setHtml(el, trusted(castleArt(side as Side))));
    this.set('enemyCastleIcon', enemy, (el, side) => setHtml(el, trusted(castleArt(side as Side))));
    this.set('myName', `${s.players[me].avatar} ${s.players[me].name}`);
    const opponent =
      s.mode === 'ai'
        ? `vs ${DIFFICULTY_LABELS[s.difficulty ?? 'normal']} AI`
        : `vs ${s.players[enemy].name} · ${s.isPrivate ? 'Friendly' : 'Ranked'}`;
    this.set('enemyName', opponent);

    if (view) {
      const player = view.players[me];
      this.set('gold', String(player.gold));
      const upkeepLabel = upkeep ? ` · −${upkeep}$ upkeep / ${GAME_RULES.economy.incomeIntervalMs / 1000}s` : ' · no upkeep';
      this.set('income', `+${player.income}$ / ${GAME_RULES.economy.incomeIntervalMs / 1000}s${upkeepLabel}`);
      const progress = 1 - view.nextIncomeInMs / GAME_RULES.economy.incomeIntervalMs;
      this.set('incomeMeter', `${Math.round(progress * 100)}`, (el, v) => (el.style.width = `${v}%`));
      this.set('army', `${army} / ${supply}`);
      this.set('armySub', upkeep ? `−${upkeep}$ upkeep / ${GAME_RULES.economy.incomeIntervalMs / 1000}s` : 'No upkeep');
      this.set('villages', String(view.buildings.filter((b) => b.side === me && b.type === 'village').length));
      this.set('timer', formatDuration(view.timeMs));
      this.root.querySelectorAll<HTMLElement>('.hud-popup .option[data-cost]').forEach((el) => {
        el.classList.toggle('unaffordable', player.gold < Number(el.dataset.cost));
      });

      const castleShare = (side: Side) => {
        const castle = view.buildings.find((b) => b.side === side && b.type === 'castle');
        return castle ? castle.hp / castle.maxHp : 0;
      };
      this.set('myCastle', `${Math.round(castleShare(me) * 1000)}`, (el, v) => (el.style.width = `${Number(v) / 10}%`));
      this.set('enemyCastle', `${Math.round(castleShare(enemy) * 1000)}`, (el, v) => (el.style.width = `${Number(v) / 10}%`));
      const myCastleHp = view.buildings.find((b) => b.side === me && b.type === 'castle')?.hp ?? 0;
      if (this.castleHp !== null && myCastleHp < this.castleHp && performance.now() - this.lastCastleAlert > CASTLE_ALERT_COOLDOWN_MS) {
        this.lastCastleAlert = performance.now();
        this.toast('🏰 Your castle is under attack!', 'bad');
      }
      this.castleHp = myCastleHp;
    }

    // Banner: incoming peace, pending proposal, or opponent disconnected.
    let banner: SafeHtml | null = null;
    const peace = view?.peace;
    if (peace && s.status === 'playing') {
      const seconds = Math.ceil(peace.expiresInMs / 1000);
      banner =
        peace.proposedBy === me
          ? html`<span>✉️ Waiting for the enemy to answer your peace proposal… <b>${seconds}s</b></span>`
          : html`<span>✉️ <b>${s.players[enemy].name}</b> proposes peace. <b>${seconds}s</b></span>
              <button type="button" class="btn-yellow btn-sm" data-action="accept-peace">Accept (draw)</button>
              <button type="button" class="btn-light btn-sm" data-action="decline-peace">Decline</button>`;
    } else if (s.mode === 'pvp' && s.status === 'playing' && !s.players[enemy].connected) {
      banner = html`<span>📡 Your opponent disconnected. They have a few seconds to return before forfeiting.</span>`;
    }
    this.set('banner', banner ? banner.value : '', (el) => {
      el.hidden = !banner;
      if (banner) setHtml(el, banner);
    });

    let overlay: SafeHtml | null = null;
    if (s.status === 'countdown') {
      const seconds = Math.max(1, Math.ceil((s.countdownEndsAt - performance.now()) / 1000));
      overlay = html`<div class="overlay-card">
        <p class="muted">${s.players.blue.name} vs ${s.players.red.name}</p>
        <div class="countdown">${seconds}</div>
        <p>You command the <b class="side-${me}">${me === 'blue' ? 'BLUE kingdom (top)' : 'RED kingdom (bottom)'}</b></p>
      </div>`;
      this.hudElapsed = HUD_INTERVAL_MS;
    } else if (s.status === 'reconnecting') {
      overlay = html`<div class="overlay-card"><span class="spinner"></span><h2>Reconnecting…</h2><p class="muted">Hold on, restoring your connection to the battle.</p></div>`;
    } else if (s.status === 'waiting') {
      overlay = html`<div class="overlay-card">
        <span class="spinner"></span>
        <h2>Waiting for an opponent…</h2>
        <p class="muted">Your opponent left before the battle started.</p>
        <button type="button" class="btn-light" data-action="lobby">Back to lobby</button>
      </div>`;
    } else if (s.status === 'closed' && !s.end) {
      overlay = html`<div class="overlay-card">
        <h2>Connection lost</h2>
        <p class="muted">The battle could not be restored.</p>
        <button type="button" class="btn-yellow" data-action="lobby">Back to lobby</button>
      </div>`;
    }
    this.set('overlay', overlay ? overlay.value : '', (el) => {
      el.hidden = !overlay;
      if (overlay) setHtml(el, overlay);
    });

    const hintText = this.hoverText ?? (performance.now() < this.hintUntil ? this.hint : this.defaultHint());
    this.set('hint', hintText);
  }

  private defaultHint() {
    if (this.session.status === 'ended') return 'The battle is over.';
    if (this.mode === 'build') return `${BUILDING_STATS[this.buildType].label}: click inside your territory to place it.`;
    if (this.mode === 'troops') {
      const f = FORMATION_STATS[this.formation];
      const view = this.view;
      const army = view ? view.units.filter((u) => u.side === this.mySide).length : 0;
      const supply = view ? armySupplyCapacity(view.buildings.filter((b) => b.side === this.mySide)) : 0;
      const upkeep = armyUpkeep(army, supply);
      return `Send ${FRACTION_LABELS[this.fraction]} in ${FORMATION_LABELS[this.formation]}: ${formationPercent(f.attackMultiplier)} attack · ${formationPercent(f.defenseMultiplier)} defence · ${formationPercent(f.speedMultiplier)} speed · supply ${army}/${supply}${upkeep ? ` · upkeep −${upkeep}$/${GAME_RULES.economy.incomeIntervalMs / 1000}s` : ''}.`;
    }
    if (this.selection.size) {
      return `${this.selection.size} troop${this.selection.size > 1 ? 's' : ''} selected · right-click to attack · Shift+right-click to move · S to hold`;
    }
    return 'Drag to select troops · click your barracks to recruit · build villages to strengthen your economy and army supply · destroy the enemy castle!';
  }

  private renderEnd() {
    const s = this.session;
    const end = s.end;
    const view = s.view;
    if (!end) return;
    const me = this.mySide;
    const enemy = s.enemySide;
    const { result } = end;
    const outcome = result.winner === null ? 'draw' : result.winner === me ? 'win' : 'loss';
    const title = outcome === 'win' ? 'Victory!' : outcome === 'loss' ? 'Defeat' : 'Draw';
    const icon = outcome === 'win' ? '👑' : outcome === 'loss' ? '🏚️' : '🤝';
    const iWon = outcome === 'win';
    const reasonText: Record<typeof result.reason, string> = {
      castle: iWon ? 'The enemy castle has fallen.' : 'Your castle has fallen.',
      surrender: iWon ? 'The enemy surrendered.' : 'You surrendered.',
      peace: 'Both rulers signed a peace treaty.',
      timeout: outcome === 'draw' ? 'Time ran out with both castles equally strong.' : `Time ran out — ${iWon ? 'your' : 'their'} castle stood stronger.`,
      disconnect: iWon ? 'Your opponent abandoned the battle.' : 'You were disconnected for too long.'
    };
    const rating = end.ratings.find((r) => r.side === me);
    const saved: SafeHtml =
      s.mode === 'pvp'
        ? rating
          ? html`<div class="end-rating">Rating ${rating.before} → <strong>${rating.after}</strong>
              <span class="rating-delta ${rating.after >= rating.before ? 'up' : 'down'}">${signed(rating.after - rating.before)}</span></div>`
          : s.isPrivate
            ? html`<p class="muted small">🤝 Friendly match — ratings unchanged. ${end.matchId ? 'Saved to your match history.' : ''}</p>`
            : html`<p class="muted small">⚠️ The result could not be recorded.</p>`
        : end.saved === 'saved'
          ? html`<p class="muted small">✅ Saved to your match history.</p>`
          : end.saved === 'saving'
            ? html`<p class="muted small">Saving to your match history…</p>`
            : end.saved === 'guest'
              ? html`<p class="muted small"><a href="/register?next=/play">Create an account</a> to keep a history of your battles.</p>`
              : html`<p class="muted small">⚠️ Could not save this battle to your history.</p>`;

    setHtml(
      $(this.root, '[data-end-content]'),
      html`<div class="end-head outcome-${outcome}">
          <div class="end-icon">${icon}</div>
          <h2>${title}</h2>
          <p>${reasonText[result.reason]}</p>
          <p class="muted small">Battle length ${formatDuration(result.timeMs)}</p>
          ${saved}
        </div>
        ${view
          ? statComparison(view.players[me].stats, view.players[enemy].stats, {
              blue: `${s.players[me].name} (you)`,
              red: s.players[enemy].name
            })
          : ''}
        <div class="modal-actions">
          <button type="button" class="btn-yellow" data-action="play-again">${s.mode === 'ai' ? '🔁 Play again' : '⚔️ Find another match'}</button>
          ${end.matchId ? html`<a class="btn-light" href="/matches/${end.matchId}">📊 Battle report</a>` : ''}
          <button type="button" class="btn-light" data-action="lobby">Lobby</button>
          <button type="button" class="btn-light" data-action="hide-end">View battlefield</button>
        </div>`
    );
    if ($(this.root, '[data-show-end]').hidden) $(this.root, '[data-end]').hidden = false;
    this.refreshHud(true);
  }
}
