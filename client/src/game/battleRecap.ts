import type PhaserType from 'phaser';
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
    case 'shot':
      return 'Fire';
    case 'hit':
      return 'Hit';
    case 'unitDied':
      return `${event.side === 'blue' ? 'Blue' : 'Red'} troop lost`;
    case 'unitTrained':
      return `${event.side === 'blue' ? 'Blue' : 'Red'} troop trained`;
    case 'buildingPlaced':
      return `${event.side === 'blue' ? 'Blue' : 'Red'} ${event.building} built`;
    case 'buildingDestroyed':
      return `${event.side === 'blue' ? 'Blue' : 'Red'} ${event.building} destroyed`;
    case 'peaceProposed':
      return `${event.by === 'blue' ? 'Blue' : 'Red'} proposed peace`;
    case 'peaceDeclined':
      return `${event.by === 'blue' ? 'Blue' : 'Red'} declined peace`;
    case 'peaceExpired':
      return 'Peace proposal expired';
    case 'matchEnded':
      return 'Battle ended';
  }
}

export class BattleRecap implements BattleReplayRecorder {
  private readonly recorded: BattleReplayFrame[] = [];
  private elapsed = 0;
  private panel: HTMLDivElement | null = null;
  private trigger: HTMLButtonElement | null = null;
  private playing = false;
  private speed = 1;
  private index = 0;
  private cursorMs = 0;
  private lastTick = 0;
  private destroyed = false;

  constructor(
    private readonly scene: BattleScene,
    private readonly battleRoot: HTMLElement,
    private readonly controller: { session: { status: string; on(listener: (signal: { type: string }) => void): () => void } }
  ) {
    const dispose = controller.session.on((signal) => {
      if (signal.type === 'end') this.showTrigger();
    });
    scene.events.once('shutdown', () => dispose());
    this.showTrigger();
  }

  record(view: MatchView, events: GameEvent[]) {
    if (this.destroyed || this.playing) return;
    this.elapsed += 1;
    const last = this.recorded[this.recorded.length - 1];
    const elapsedHint = view.timeMs - (last?.view.timeMs ?? -SAMPLE_MS);
    if (elapsedHint < SAMPLE_MS && !view.result && !events.length) return;
    this.recorded.push({ view: cloneView(view), events: events.map((event) => ({ ...event } as GameEvent)) });
    if (this.recorded.length > MAX_FRAMES) this.recorded.splice(0, this.recorded.length - MAX_FRAMES);
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
  }

  private close() {
    this.stop();
    this.panel?.remove();
    this.panel = null;
    const end = this.battleRoot.querySelector<HTMLElement>('[data-end]');
    if (end) end.hidden = false;
    this.trigger?.removeAttribute('hidden');
    this.scene.setReplayView(null);
  }

  private render() {
    if (!this.panel) return;
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
          <span class="battle-recap-kicker">BATTLE DOCUMENTARY</span>
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
          ${events.map((event) => `<button type="button" class="battle-recap-event" style="left:${(event.timeMs / Math.max(1, duration)) * 100}%" title="${event.labels.join(', ')}" data-recap-index="${event.frameIndex}"></button>`).join('')}
        </div>
        <input data-recap="scrub" type="range" min="0" max="${this.recorded.length - 1}" step="1" value="${this.index}" aria-label="Battle timeline">
        <div class="battle-recap-scale"><span>00:00</span><span>${formatTime(duration)}</span></div>
      </div>
      <div class="battle-recap-summary">
        <span><b>Blue</b> ${blueAlive} troops</span>
        <span><b>Red</b> ${redAlive} troops</span>
        <span>${totalEvents} recorded events</span>
        <span>Frontline + influence reconstructed from each frame</span>
      </div>
      <div class="battle-recap-events-list">
        ${events.slice(Math.max(0, events.length - 6)).reverse().map((event) => `<span>${formatTime(event.timeMs)} · ${event.labels.join(' · ')}</span>`).join('') || '<span>No discrete events were recorded.</span>'}
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
        this.render();
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
      const mid = Math.ceil((lo + hi) / 2);
      if (this.recorded[mid].view.timeMs >= timeMs) hi = mid - 1;
      else lo = mid;
    }
    return Math.max(0, Math.min(this.recorded.length - 1, lo));
  }

  private seek(index: number, rerender = true) {
    this.index = Math.max(0, Math.min(this.recorded.length - 1, index));
    this.cursorMs = this.recorded[this.index]?.view.timeMs ?? 0;
    const frame = this.recorded[this.index];
    if (frame) this.scene.setReplayView(frame.view);
    if (rerender) {
      this.render();
      this.renderPlayState();
    }
  }

  private renderPlayState() {
    const button = this.panel?.querySelector<HTMLButtonElement>('[data-recap="play"]');
    if (button) button.textContent = this.playing ? '⏸ Pause' : '▶ Play';
  }
}

export function createBattleRecap(scene: BattleScene, battleRoot: HTMLElement, controller: { session: { on(listener: (signal: { type: string }) => void): () => void } }) {
  return new BattleRecap(scene, battleRoot, controller);
}
