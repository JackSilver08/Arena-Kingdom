import type { GameEvent, MatchView } from '@arena-kingdom/shared';
import type { BattleScene } from './BattleScene';

export interface BattleReplayFrame {
  view: MatchView;
  events: GameEvent[];
}

export interface BattleReplayRecorder {
  record(view: MatchView, events: GameEvent[]): void;
  frames(): readonly BattleReplayFrame[];
}

const SAMPLE_MS = 250;
const MAX_FRAMES = 9_000;
const SPEEDS = [0.25, 0.5, 1, 2];

export function recentReplayEvents(frames: readonly BattleReplayFrame[], index: number) {
  const recent: BattleReplayFrame[] = [];
  for (let i = Math.min(index, frames.length - 1); i >= 0 && recent.length < 6; i--) {
    if (frames[i].events.length) recent.push(frames[i]);
  }
  return recent;
}

function cloneView(view: MatchView): MatchView {
  return {
    timeMs: view.timeMs,
    nextIncomeInMs: view.nextIncomeInMs,
    players: {
      blue: { ...view.players.blue, stats: { ...view.players.blue.stats } },
      red: { ...view.players.red, stats: { ...view.players.red.stats } }
    },
    units: view.units.map((unit) => ({ ...unit })),
    buildings: view.buildings.map((building) => ({ ...building })),
    peace: view.peace ? { ...view.peace } : null,
    result: view.result ? { ...view.result } : null
  };
}

function formatTime(timeMs: number) {
  const total = Math.max(0, Math.floor(timeMs / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function eventLabel(event: GameEvent) {
  switch (event.type) {
    case 'shot': return 'Fire';
    case 'arrowShot': return 'Arrow fired';
    case 'cannonShot': return 'Cannon fired';
    case 'hit': return 'Hit';
    case 'unitDied': return `${event.side === 'blue' ? 'Blue' : 'Red'} troop lost`;
    case 'unitTrained': return `${event.side === 'blue' ? 'Blue' : 'Red'} troop trained`;
    case 'buildingPlaced': return `${event.side === 'blue' ? 'Blue' : 'Red'} ${event.building} built`;
    case 'buildingDestroyed': return `${event.side === 'blue' ? 'Blue' : 'Red'} ${event.building} destroyed`;
    case 'peaceProposed': return `${event.by === 'blue' ? 'Blue' : 'Red'} proposed peace`;
    case 'peaceDeclined': return `${event.by === 'blue' ? 'Blue' : 'Red'} declined peace`;
    case 'peaceExpired': return 'Peace proposal expired';
    case 'matchEnded': return 'Battle ended';
  }
}

export class BattleRecap implements BattleReplayRecorder {
  private readonly recorded: BattleReplayFrame[] = [];
  private pendingEvents: GameEvent[] = [];
  private finalized = false;
  private panel: HTMLDivElement | null = null;
  private trigger: HTMLButtonElement | null = null;
  private playing = false;
  private speed = 1;
  private index = 0;
  private cursorMs = 0;
  private lastTick = 0;
  private destroyed = false;
  private readoutIndex = -1;

  constructor(
    private readonly scene: BattleScene,
    private readonly battleRoot: HTMLElement,
    private readonly controller: { session: { on(listener: (signal: { type: string }) => void): () => void } }
  ) {
    const dispose = controller.session.on((signal) => {
      if (signal.type === 'end') this.showTrigger();
    });
    scene.events.once('shutdown', () => dispose());
  }

  record(view: MatchView, events: GameEvent[]) {
    if (this.destroyed || this.playing || this.finalized) return;
    // Events between samples belong to the next snapshot. Combat never bypasses
    // the sample cadence, avoiding a full state clone for every rendered frame.
    this.pendingEvents.push(...events.map(event => ({ ...event } as GameEvent)));
    if (this.pendingEvents.length > 512) this.pendingEvents.splice(0, this.pendingEvents.length - 512);
    const last = this.recorded[this.recorded.length - 1];
    const elapsedHint = view.timeMs - (last?.view.timeMs ?? -SAMPLE_MS);
    if (elapsedHint < SAMPLE_MS && !view.result) return;
    this.recorded.push({ view: cloneView(view), events: this.pendingEvents });
    this.pendingEvents = [];
    this.finalized = Boolean(view.result);
    // Beyond a 37.5 minute recording, compact older samples instead of losing
    // the opening. Normal 20-minute matches fit without any compaction.
    if (this.recorded.length > MAX_FRAMES) {
      const compact: BattleReplayFrame[] = [this.recorded[0]];
      for (let i = 1; i < this.recorded.length - 1; i += 2) {
        const next = this.recorded[Math.min(i + 1, this.recorded.length - 2)];
        compact.push({ view: next.view, events: [...this.recorded[i].events, ...(next === this.recorded[i] ? [] : next.events)].slice(-512) });
      }
      compact.push(this.recorded[this.recorded.length - 1]);
      this.recorded.splice(0, this.recorded.length, ...compact);
    }
  }

  frames() {
    return this.recorded;
  }

  destroy() {
    this.destroyed = true;
    this.stop();
    this.panel?.remove();
    this.trigger?.remove();
    this.panel = null;
    this.trigger = null;
  }

  private showTrigger() {
    if (this.destroyed || this.trigger || this.recorded.length < 2) return;
    this.trigger = document.createElement('button');
    this.trigger.type = 'button';
    this.trigger.className = 'battle-recap-trigger btn-yellow';
    this.trigger.textContent = '🎞️ Battle Recap';
    this.trigger.addEventListener('click', () => this.open());
    this.battleRoot.append(this.trigger);
  }

  private open() {
    if (this.recorded.length < 2 || this.destroyed) return;
    this.playing = false;
    this.index = this.recorded.length - 1;
    this.cursorMs = this.recorded[this.index].view.timeMs;
    const end = this.battleRoot.querySelector<HTMLElement>('[data-end]');
    if (end) end.hidden = true;
    this.trigger?.setAttribute('hidden', 'true');
    this.panel = document.createElement('div');
    this.panel.className = 'battle-recap-panel';
    this.battleRoot.append(this.panel);
    this.render();
    this.seek(this.index);
    this.panel.querySelector<HTMLButtonElement>('[data-recap="close"]')?.focus();
  }

  private close() {
    this.stop();
    this.panel?.remove();
    this.panel = null;
    const end = this.battleRoot.querySelector<HTMLElement>('[data-end]');
    if (end) end.hidden = false;
    this.trigger?.removeAttribute('hidden');
    this.scene.setReplayView(null);
    end?.querySelector<HTMLElement>('button, a[href]')?.focus();
  }

  private render() {
    if (!this.panel) return;
    this.readoutIndex = -1;
    const duration = this.recorded[this.recorded.length - 1].view.timeMs;
    const events = this.recorded.flatMap((frame, frameIndex) =>
      frame.events.length ? [{ frameIndex, timeMs: frame.view.timeMs, labels: frame.events.map(eventLabel) }] : []
    );
    const totalEvents = events.reduce((sum, event) => sum + event.labels.length, 0);
    const blueAlive = this.recorded[this.index]?.view.units.filter((u) => u.side === 'blue').length ?? 0;
    const redAlive = this.recorded[this.index]?.view.units.filter((u) => u.side === 'red').length ?? 0;
    const current = this.recorded[this.index]?.view.timeMs ?? 0;

    this.panel.innerHTML = `
      <div class="battle-recap-head">
        <div>
          <span class="battle-recap-kicker">ARENA KINGDOM · YOUR PERSPECTIVE</span>
          <strong>Battle Recap</strong>
          <small>Scrub the campaign, then replay it at quarter speed or double speed.</small>
        </div>
        <button type="button" class="btn-light btn-sm" data-recap="close">Close</button>
      </div>
      <div class="battle-recap-toolbar">
        <button type="button" class="btn-yellow btn-sm" data-recap="play">▶ Play</button>
        <button type="button" class="btn-light btn-sm" data-recap="step-back">◀ Step</button>
        <button type="button" class="btn-light btn-sm" data-recap="step-forward">Step ▶</button>
        <span class="battle-recap-clock" data-recap="clock">${formatTime(current)} / ${formatTime(duration)}</span>
        <div class="battle-recap-speeds" role="group" aria-label="Replay speed">
          ${SPEEDS.map((value) => `<button type="button" class="btn-light btn-sm ${value === this.speed ? 'active' : ''}" data-recap-speed="${value}">${value}×</button>`).join('')}
        </div>
      </div>
      <div class="battle-recap-timeline">
        <div class="battle-recap-events">
          ${events.filter((_, index) => index % Math.max(1, Math.ceil(events.length / 300)) === 0).map((event) => `<button type="button" class="battle-recap-event" style="left:${(event.timeMs / Math.max(1, duration)) * 100}%" title="${event.labels.join(', ')}" aria-label="${formatTime(event.timeMs)}: ${event.labels.join(', ')}" data-recap-index="${event.frameIndex}"></button>`).join('')}
        </div>
        <input data-recap="scrub" type="range" min="0" max="${this.recorded.length - 1}" step="1" value="${this.index}" aria-label="Battle timeline">
        <div class="battle-recap-scale"><span>00:00</span><span>${formatTime(duration)}</span></div>
      </div>
      <div class="battle-recap-summary">
        <span data-recap="blueCount">Blue ${blueAlive} troops</span>
        <span data-recap="redCount">Red ${redAlive} troops</span>
        <span>${totalEvents} recorded events</span>
        <span>Influence + frontline reconstructed from each frame</span>
      </div>
      <div class="battle-recap-events-list">
        ${this.recentEventsMarkup()}
      </div>`;

    this.panel.querySelector<HTMLButtonElement>('[data-recap="close"]')?.addEventListener('click', () => this.close());
    this.panel.querySelector<HTMLButtonElement>('[data-recap="play"]')?.addEventListener('click', () => this.togglePlay());
    this.panel.querySelector<HTMLButtonElement>('[data-recap="step-back"]')?.addEventListener('click', () => this.seek(this.index - 1));
    this.panel.querySelector<HTMLButtonElement>('[data-recap="step-forward"]')?.addEventListener('click', () => this.seek(this.index + 1));
    this.panel.querySelector<HTMLInputElement>('[data-recap="scrub"]')?.addEventListener('input', (event) => {
      this.stop();
      this.seek(Number((event.target as HTMLInputElement).value));
    });
    this.panel.querySelectorAll<HTMLButtonElement>('[data-recap-speed]').forEach((button) => {
      button.addEventListener('click', () => {
        this.speed = Number(button.dataset.recapSpeed);
        this.panel?.querySelectorAll<HTMLButtonElement>('[data-recap-speed]').forEach(control => control.classList.toggle('active', Number(control.dataset.recapSpeed) === this.speed));
        this.renderPlayState();
      });
    });
    this.panel.querySelectorAll<HTMLButtonElement>('[data-recap-index]').forEach((button) => {
      button.addEventListener('click', () => this.seek(Number(button.dataset.recapIndex)));
    });
  }

  private togglePlay() {
    if (this.playing) this.stop();
    else this.start();
    this.renderPlayState();
  }

  private start() {
    if (this.index >= this.recorded.length - 1) this.seek(0);
    this.playing = true;
    this.lastTick = performance.now();
    requestAnimationFrame(this.frame);
  }

  private stop() {
    this.playing = false;
  }

  private readonly frame = (now: number) => {
    if (!this.playing || this.destroyed) return;
    const elapsed = Math.min(80, now - this.lastTick);
    this.lastTick = now;
    this.cursorMs += elapsed * this.speed;
    const nextIndex = this.findIndexAt(this.cursorMs);
    if (nextIndex !== this.index) this.seek(nextIndex, false);
    this.syncReadout();
    if (this.index >= this.recorded.length - 1) {
      this.playing = false;
      this.renderPlayState();
      return;
    }
    requestAnimationFrame(this.frame);
  };

  private findIndexAt(timeMs: number) {
    let lo = 0;
    let hi = this.recorded.length - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      if (this.recorded[mid].view.timeMs <= timeMs) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  private seek(index: number, rerender = true) {
    this.index = Math.max(0, Math.min(this.recorded.length - 1, index));
    this.cursorMs = this.recorded[this.index]?.view.timeMs ?? 0;
    const frame = this.recorded[this.index];
    if (frame) {
      this.scene.setReplayView(frame.view);
      if (frame.events.length) {
        // BattleScene owns the existing combat effects. The cast only exposes
        // that already-present private renderer to recap, without duplicating
        // the visual effects implementation.
        const effects = this.scene as unknown as { playEvents(events: GameEvent[]): void };
        effects.playEvents(frame.events);
      }
    }
    if (rerender) {
      this.syncReadout();
      this.renderPlayState();
    }
  }

  private syncReadout() {
    if (this.readoutIndex === this.index) return;
    this.readoutIndex = this.index;
    const clock = this.panel?.querySelector<HTMLElement>('[data-recap="clock"]');
    const scrub = this.panel?.querySelector<HTMLInputElement>('[data-recap="scrub"]');
    const current = this.recorded[this.index]?.view.timeMs ?? 0;
    const duration = this.recorded[this.recorded.length - 1]?.view.timeMs ?? 0;
    if (clock) clock.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    if (scrub) scrub.value = String(this.index);
    const view = this.recorded[this.index]?.view;
    for (const side of ['blue', 'red'] as const) {
      const count = this.panel?.querySelector<HTMLElement>(`[data-recap="${side}Count"]`);
      if (count) count.textContent = `${side === 'blue' ? 'Blue' : 'Red'} ${view?.units.filter(unit => unit.side === side).length ?? 0} troops`;
    }
    const list = this.panel?.querySelector<HTMLElement>('.battle-recap-events-list');
    if (list) list.innerHTML = this.recentEventsMarkup();
  }

  private recentEventsMarkup() {
    return recentReplayEvents(this.recorded, this.index).map(frame => `<span>${formatTime(frame.view.timeMs)} · ${frame.events.map(eventLabel).join(' · ')}</span>`).join('') || '<span>No events before this point.</span>';
  }

  private renderPlayState() {
    const button = this.panel?.querySelector<HTMLButtonElement>('[data-recap="play"]');
    if (button) button.textContent = this.playing ? '⏸ Pause' : '▶ Play';
  }
}

export function createBattleRecap(scene: BattleScene, battleRoot: HTMLElement, controller: { session: { on(listener: (signal: { type: string }) => void): () => void } }) {
  return new BattleRecap(scene, battleRoot, controller);
}
