import { DIFFICULTIES, DIFFICULTY_LABELS, type Difficulty, type Side } from '@arena-kingdom/shared';
import { avatar, toast } from '../components/ui';
import { $, html, setHtml } from '../lib/html';
import { navigate, type Page } from '../lib/router';
import { session } from '../lib/session';
import { OnlineSession, describeJoinError, setPendingSession, storedReconnectToken } from '../game/session';

const DIFFICULTY_INFO: Record<Difficulty, { icon: string; text: string }> = {
  easy: { icon: '🌱', text: 'Builds slowly and attacks late with small waves. Perfect for learning the controls.' },
  normal: { icon: '🛡️', text: 'A balanced economy, two barracks and real attack waves around the two-minute mark.' },
  hard: { icon: '🔥', text: 'Greedy economy, early pressure, reinforcements and tactical retreats. Bring a plan.' }
};

const DIFFICULTY_KEY = 'ak.difficulty';

function savedDifficulty(): Difficulty {
  try {
    const value = localStorage.getItem(DIFFICULTY_KEY);
    return DIFFICULTIES.includes(value as Difficulty) ? (value as Difficulty) : 'normal';
  } catch {
    return 'normal';
  }
}

export function playPage(): Page {
  let online: OnlineSession | null = null;
  let handedOff = false;
  let unsubscribe: (() => void) | null = null;

  return {
    title: 'Play',
    mount(root) {
      const user = session.user;
      let difficulty = savedDifficulty();
      const canResume = Boolean(user && storedReconnectToken());

      setHtml(
        root,
        html`<section class="wrap page">
          <div class="page-head">
            <div>
              <h1>Choose your battle</h1>
              <p class="muted">Offline against the AI, or online against another ruler.</p>
            </div>
            <a class="btn btn-ghost" href="/guide">📖 How to play</a>
          </div>

          ${canResume
            ? html`<div class="alert alert-info resume">
                <span>⚔️ You were in an online battle that may still be running.</span>
                <a class="btn btn-primary btn-sm" href="/battle?resume=1">Rejoin battle</a>
              </div>`
            : ''}

          <div class="play-grid">
            <div class="panel play-card">
              <div class="panel-head"><h2>🤖 Battle the AI</h2><span class="chip">Offline · instant</span></div>
              <div class="difficulty-list" role="radiogroup" aria-label="AI difficulty">
                ${DIFFICULTIES.map(
                  (d) => html`<label class="difficulty">
                    <input type="radio" name="difficulty" value="${d}" ${d === difficulty ? html`checked` : ''} />
                    <span class="difficulty-icon">${DIFFICULTY_INFO[d].icon}</span>
                    <span class="difficulty-body">
                      <strong>${DIFFICULTY_LABELS[d]}</strong>
                      <small>${DIFFICULTY_INFO[d].text}</small>
                    </span>
                  </label>`
                )}
              </div>
              <button class="btn btn-primary btn-lg btn-block" type="button" data-start-ai>Start battle</button>
              <p class="muted small">
                ${user
                  ? html`Results are saved to your <a href="/history?mode=ai">match history</a>.`
                  : html`Playing as a guest. <a href="/login?next=/play">Sign in</a> to save your results.`}
              </p>
            </div>

            <div class="panel play-card">
              <div class="panel-head"><h2>🏆 Online 1v1</h2><span class="chip chip-pvp">Ranked · Elo</span></div>
              ${user
                ? html`<div class="online-me">
                      ${avatar(user.avatar, 'lg')}
                      <div><strong>${user.displayName}</strong><small class="muted">Rating ${user.rating}</small></div>
                    </div>
                    <div data-online-actions>
                      <button class="btn btn-primary btn-lg btn-block" type="button" data-ranked>⚔️ Find ranked match</button>
                      <div class="divider"><span>or play a friend</span></div>
                      <div class="private-actions">
                        <button class="btn btn-secondary" type="button" data-create>🔐 Create private room</button>
                        <p class="muted small">Private rooms are friendly matches: saved to history, ratings unchanged.</p>
                        <form class="join-form" data-join>
                          <input name="code" placeholder="Room code" autocomplete="off" maxlength="32" aria-label="Room code" />
                          <button class="btn btn-secondary" type="submit">Join</button>
                        </form>
                      </div>
                    </div>
                    <div class="matchmaking" data-matchmaking hidden></div>`
                : html`<div class="empty">
                    <div class="empty-icon">🔒</div>
                    <p>Online battles need an account so your rating and history can be tracked.</p>
                    <div class="actions">
                      <a class="btn btn-primary" href="/login?next=/play">Sign in</a>
                      <a class="btn btn-secondary" href="/register?next=/play">Create account</a>
                    </div>
                  </div>`}
            </div>
          </div>
        </section>`
      );

      root.querySelectorAll<HTMLInputElement>('input[name="difficulty"]').forEach((input) => {
        input.addEventListener('change', () => {
          difficulty = input.value as Difficulty;
          try {
            localStorage.setItem(DIFFICULTY_KEY, difficulty);
          } catch {
            // Preference only.
          }
        });
      });
      $(root, '[data-start-ai]').addEventListener('click', () => navigate(`/battle?mode=ai&difficulty=${difficulty}`));

      if (!user) return;
      const actions = $(root, '[data-online-actions]');
      const panel = $(root, '[data-matchmaking]');

      const renderPanel = () => {
        const s = online;
        if (!s) return;
        const seat = (side: Side) => {
          const p = s.players[side];
          const mine = side === s.mySide;
          return html`<div class="seat side-${side} ${p.username ? 'filled' : ''}">
            ${avatar(p.avatar, 'md')}
            <div><strong>${p.name}${mine ? ' (you)' : ''}</strong><small>${p.rating !== null ? `Rating ${p.rating}` : 'Empty seat'}</small></div>
          </div>`;
        };
        const status =
          s.status === 'countdown'
            ? html`<p class="mm-status ready">Opponent found! Preparing the battlefield…</p>`
            : s.isPrivate
              ? html`<p class="mm-status"><span class="spinner"></span>Waiting for your friend to join…</p>`
              : html`<p class="mm-status"><span class="spinner"></span>Searching for an opponent…</p>`;
        setHtml(
          panel,
          html`${status}
            ${s.isPrivate && s.roomId
              ? html`<div class="room-code">
                  <span class="muted">Room code</span>
                  <code>${s.roomId}</code>
                  <button type="button" class="btn btn-ghost btn-sm" data-copy>Copy</button>
                </div>`
              : ''}
            <div class="seats">${seat('blue')}<span class="vs">VS</span>${seat('red')}</div>
            <button type="button" class="btn btn-ghost btn-block" data-cancel>Cancel</button>`
        );
        panel.querySelector('[data-copy]')?.addEventListener('click', () => {
          void navigator.clipboard?.writeText(s.roomId ?? '').then(() => toast('Room code copied.', 'success'));
        });
        panel.querySelector('[data-cancel]')?.addEventListener('click', cancel);
      };

      const cancel = () => {
        unsubscribe?.();
        online?.dispose();
        online = null;
        panel.hidden = true;
        actions.hidden = false;
      };

      const start = async (kind: 'ranked' | 'create' | 'code', code = '', button?: HTMLButtonElement | null) => {
        if (online) return;
        actions.querySelectorAll('button').forEach((b) => (b.disabled = true));
        if (button) button.classList.add('is-busy');
        try {
          const s = await OnlineSession.join(kind, code);
          online = s;
          actions.hidden = true;
          panel.hidden = false;
          renderPanel();
          unsubscribe = s.on((signal) => {
            if (signal.type === 'players' || signal.type === 'status') renderPanel();
            if (s.status === 'countdown' || s.status === 'playing') {
              handedOff = true;
              unsubscribe?.();
              setPendingSession(s);
              navigate('/battle?mode=online');
            } else if (s.status === 'closed') {
              toast('Disconnected from the room.', 'error');
              cancel();
            }
          });
        } catch (error) {
          toast(describeJoinError(error), 'error');
        } finally {
          actions.querySelectorAll('button').forEach((b) => (b.disabled = false));
          button?.classList.remove('is-busy');
        }
      };

      $(root, '[data-ranked]').addEventListener('click', (event) => void start('ranked', '', event.currentTarget as HTMLButtonElement));
      $(root, '[data-create]').addEventListener('click', (event) => void start('create', '', event.currentTarget as HTMLButtonElement));
      const joinForm = $<HTMLFormElement>(root, '[data-join]');
      joinForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const code = String(new FormData(joinForm).get('code') ?? '').trim();
        if (!code) return toast('Enter the room code your friend shared.', 'error');
        void start('code', code, joinForm.querySelector('button'));
      });
    },
    destroy() {
      unsubscribe?.();
      if (!handedOff) online?.dispose();
    }
  };
}
