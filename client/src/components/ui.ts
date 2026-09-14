import {
  DIFFICULTY_LABELS,
  END_REASON_LABELS,
  type MatchOutcome,
  type MatchParticipant,
  type MatchSummary,
  type PublicUser
} from '@arena-kingdom/shared';
import { formatDuration, signed, timeAgo } from '../lib/format';
import { html, type SafeHtml } from '../lib/html';

export function avatar(emoji: string, size: 'sm' | 'md' | 'lg' | 'xl' = 'md') {
  return html`<span class="avatar avatar-${size}" aria-hidden="true">${emoji}</span>`;
}

export function userLink(user: Pick<PublicUser, 'username' | 'displayName' | 'avatar'>) {
  return html`<a class="user-link" href="/players/${encodeURIComponent(user.username)}">${avatar(user.avatar, 'sm')}<span>${user.displayName}</span></a>`;
}

export function participantName(p: MatchParticipant) {
  if (p.username) {
    return html`<a class="user-link" href="/players/${encodeURIComponent(p.username)}">${avatar(p.avatar, 'sm')}<span>${p.displayName}</span></a>`;
  }
  return html`<span class="user-link">${avatar(p.avatar, 'sm')}<span>${p.displayName}</span></span>`;
}

const OUTCOME_LABEL: Record<MatchOutcome, string> = { win: 'Victory', loss: 'Defeat', draw: 'Draw' };

export function outcomeBadge(outcome: MatchOutcome) {
  return html`<span class="badge badge-${outcome}">${OUTCOME_LABEL[outcome]}</span>`;
}

export function modeChip(match: Pick<MatchSummary, 'mode' | 'difficulty' | 'rated'>) {
  if (match.mode === 'pvp' && match.rated) return html`<span class="chip chip-pvp">⚔️ Ranked 1v1</span>`;
  if (match.mode === 'pvp') return html`<span class="chip">🤝 Friendly 1v1</span>`;
  return html`<span class="chip chip-ai">🤖 vs AI · ${match.difficulty ? DIFFICULTY_LABELS[match.difficulty] : 'Unknown'}</span>`;
}

/** A match row; with a perspective user the row is written from that player's point of view. */
export function matchRow(match: MatchSummary, perspectiveUserId?: number | null) {
  const me = perspectiveUserId ? match.players.find((p) => p.userId === perspectiveUserId) : undefined;
  const blue = match.players.find((p) => p.side === 'blue');
  const red = match.players.find((p) => p.side === 'red');
  let lead: SafeHtml;
  let body: SafeHtml;
  if (me) {
    const opponent = match.players.find((p) => p !== me);
    const delta = me.ratingBefore !== null && me.ratingAfter !== null ? me.ratingAfter - me.ratingBefore : null;
    lead = outcomeBadge(me.outcome);
    body = html`<div class="match-row-main">
        <div class="match-row-title">vs ${opponent ? participantName(opponent) : 'Unknown'}</div>
        <div class="match-row-meta">${modeChip(match)}<span>${END_REASON_LABELS[match.endReason]}</span></div>
      </div>
      ${delta !== null ? html`<span class="rating-delta ${delta >= 0 ? 'up' : 'down'}">${signed(delta)}</span>` : ''}`;
  } else {
    const winner = match.players.find((p) => p.outcome === 'win');
    lead = html`<span class="badge badge-neutral">${winner ? `${winner.side === 'blue' ? '🔵' : '🔴'} Won` : 'Draw'}</span>`;
    body = html`<div class="match-row-main">
      <div class="match-row-title">${blue ? participantName(blue) : ''}<span class="vs">vs</span>${red ? participantName(red) : ''}</div>
      <div class="match-row-meta">${modeChip(match)}<span>${END_REASON_LABELS[match.endReason]}</span></div>
    </div>`;
  }
  return html`<li class="match-row">
    ${lead}
    ${body}
    <div class="match-row-side">
      <span title="Duration">⏱ ${formatDuration(match.durationMs)}</span>
      <span class="muted" title="${new Date(match.endedAt).toLocaleString()}">${timeAgo(match.endedAt)}</span>
    </div>
    <a class="match-row-link" href="/matches/${encodeURIComponent(match.id)}" aria-label="View match details">Details →</a>
  </li>`;
}

export function matchList(matches: MatchSummary[], perspectiveUserId?: number | null, empty = 'No battles yet.') {
  if (!matches.length) return emptyState('📜', empty);
  return html`<ul class="match-list">${matches.map((m) => matchRow(m, perspectiveUserId))}</ul>`;
}

export function emptyState(icon: string, text: string, action?: SafeHtml) {
  return html`<div class="empty"><div class="empty-icon">${icon}</div><p>${text}</p>${action ?? ''}</div>`;
}

export function loading(text = 'Loading…') {
  return html`<div class="loading"><span class="spinner"></span>${text}</div>`;
}

export function errorBox(message: string) {
  return html`<div class="alert alert-error" role="alert">${message}</div>`;
}

export function statTile(label: string, value: string | number, hint?: string) {
  return html`<div class="stat-tile"><span class="stat-label">${label}</span><strong>${value}</strong>${hint ? html`<small>${hint}</small>` : ''}</div>`;
}

let toastRoot: HTMLElement | null = null;

export function toast(message: string, kind: 'info' | 'success' | 'error' = 'info') {
  if (!toastRoot) {
    toastRoot = document.createElement('div');
    toastRoot.className = 'site-toasts';
    toastRoot.setAttribute('aria-live', 'polite');
    document.body.append(toastRoot);
  }
  const item = document.createElement('div');
  item.className = `site-toast toast-${kind}`;
  item.textContent = message;
  toastRoot.append(item);
  setTimeout(() => {
    item.classList.add('leaving');
    setTimeout(() => item.remove(), 300);
  }, 3200);
}

export function formError(form: HTMLFormElement, message: string | null) {
  const box = form.querySelector<HTMLElement>('[data-form-error]');
  if (!box) return;
  box.hidden = !message;
  box.textContent = message ?? '';
}

export async function withBusy(button: HTMLButtonElement | null, task: () => Promise<void>) {
  if (button) {
    button.disabled = true;
    button.classList.add('is-busy');
  }
  try {
    await task();
  } finally {
    if (button) {
      button.disabled = false;
      button.classList.remove('is-busy');
    }
  }
}
