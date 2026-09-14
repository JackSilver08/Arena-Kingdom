import { DIFFICULTY_LABELS, END_REASON_LABELS, type MatchParticipant, type MatchSummary } from '@arena-kingdom/shared';
import { statComparison } from '../components/statComparison';
import { errorBox, loading, modeChip, outcomeBadge, participantName } from '../components/ui';
import { api } from '../lib/api';
import { formatDateTime, formatDuration, signed } from '../lib/format';
import { html, setHtml } from '../lib/html';
import type { Page, RouteContext } from '../lib/router';
import { session } from '../lib/session';

function playerCard(p: MatchParticipant) {
  const delta = p.ratingBefore !== null && p.ratingAfter !== null ? p.ratingAfter - p.ratingBefore : null;
  return html`<div class="match-player side-${p.side}">
    <span class="side-label">${p.side === 'blue' ? '🔵 Blue kingdom' : '🔴 Red kingdom'}</span>
    <div class="match-player-name">${participantName(p)}</div>
    ${outcomeBadge(p.outcome)}
    ${delta !== null
      ? html`<span class="muted">Rating ${p.ratingBefore} → <strong>${p.ratingAfter}</strong>
          <span class="rating-delta ${delta >= 0 ? 'up' : 'down'}">${signed(delta)}</span></span>`
      : html`<span class="muted">${p.isBot ? 'Computer opponent' : 'Unrated'}</span>`}
  </div>`;
}

function render(match: MatchSummary) {
  const blue = match.players.find((p) => p.side === 'blue');
  const red = match.players.find((p) => p.side === 'red');
  const me = session.user ? match.players.find((p) => p.userId === session.user!.id) : undefined;
  const headline = me ? (me.outcome === 'win' ? 'Victory' : me.outcome === 'loss' ? 'Defeat' : 'Draw') : 'Battle report';
  return html`<section class="wrap page">
    <p class="breadcrumbs"><a href="${session.user ? '/history' : '/'}">← ${session.user ? 'Match history' : 'Home'}</a></p>
    <div class="match-hero outcome-${me?.outcome ?? 'neutral'}">
      <div>
        <span class="eyebrow">${modeChip(match)}</span>
        <h1>${headline}</h1>
        <p class="muted">
          ${END_REASON_LABELS[match.endReason]} · ${formatDuration(match.durationMs)} · ${formatDateTime(match.endedAt)}
          ${match.difficulty ? html` · AI commander: ${DIFFICULTY_LABELS[match.difficulty]}` : ''}
        </p>
      </div>
    </div>
    <div class="match-players">
      ${blue ? playerCard(blue) : ''}
      <div class="match-vs">VS</div>
      ${red ? playerCard(red) : ''}
    </div>
    ${blue && red
      ? html`<div class="panel">
          <div class="panel-head"><h2>📊 Battle statistics</h2></div>
          ${statComparison(blue.stats, red.stats, { blue: blue.displayName, red: red.displayName })}
        </div>`
      : ''}
  </section>`;
}

export function matchPage(ctx: RouteContext): Page {
  let alive = true;
  return {
    title: 'Battle report',
    mount(root) {
      setHtml(root, html`<section class="wrap page">${loading('Loading battle report…')}</section>`);
      api
        .match(ctx.params.id)
        .then((match) => alive && setHtml(root, render(match)))
        .catch((error: Error) => alive && setHtml(root, html`<section class="wrap page">${errorBox(error.message)}</section>`));
    },
    destroy() {
      alive = false;
    }
  };
}
