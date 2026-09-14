import { ACCOUNT_RULES, DIFFICULTIES, DIFFICULTY_LABELS, type ProfileResponse } from '@arena-kingdom/shared';
import { avatar, errorBox, formError, loading, matchList, statTile, toast, withBusy } from '../components/ui';
import { api } from '../lib/api';
import { formatDate, formatLongDuration, formatNumber, winRate } from '../lib/format';
import { $, html, setHtml, type SafeHtml } from '../lib/html';
import type { Page } from '../lib/router';
import { session } from '../lib/session';
import { avatarPicker } from './auth';

/** Profile header and stats, shared by the private profile and public player pages. */
export function profileOverview(profile: ProfileResponse, extra?: SafeHtml) {
  const { user, stats, rank } = profile;
  const { pvp, ai, totals } = stats;
  return html`<div class="profile-hero">
      ${avatar(user.avatar, 'xl')}
      <div class="profile-id">
        <h1>${user.displayName}</h1>
        <p class="muted">@${user.username} · Ruler since ${formatDate(user.createdAt)}</p>
      </div>
      <div class="profile-rating">
        <span class="stat-label">Rating</span>
        <strong>${user.rating}</strong>
        <small>${rank ? `Rank #${rank}` : 'Unranked'} · Peak ${stats.peakRating}</small>
      </div>
      ${extra ?? ''}
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h2>🏆 Online 1v1</h2></div>
        <div class="stat-grid">
          ${statTile('Played', pvp.played)} ${statTile('Wins', pvp.wins)} ${statTile('Losses', pvp.losses)}
          ${statTile('Draws', pvp.draws)} ${statTile('Win rate', winRate(pvp.wins, pvp.played))}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>🤖 Versus AI</h2></div>
        <div class="stat-grid">
          ${statTile('Played', ai.played)} ${statTile('Wins', ai.wins)} ${statTile('Win rate', winRate(ai.wins, ai.played))}
        </div>
        <table class="mini-table">
          <thead><tr><th>Commander</th><th>W</th><th>L</th><th>D</th></tr></thead>
          <tbody>
            ${DIFFICULTIES.map((d) => {
              const r = ai.byDifficulty[d];
              return html`<tr><td>${DIFFICULTY_LABELS[d]}</td><td>${r.wins}</td><td>${r.losses}</td><td>${r.draws}</td></tr>`;
            })}
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>⚔️ Career totals</h2></div>
      <div class="stat-grid stat-grid-wide">
        ${statTile('Soldiers trained', formatNumber(totals.unitsTrained))} ${statTile('Enemies slain', formatNumber(totals.kills))}
        ${statTile('Buildings raised', formatNumber(totals.buildingsBuilt))}
        ${statTile('Buildings razed', formatNumber(totals.buildingsDestroyed))} ${statTile('Gold earned', formatNumber(totals.goldEarned))}
        ${statTile('Time in battle', formatLongDuration(totals.playTimeMs))}
      </div>
    </div>`;
}

export function profilePage(): Page {
  let alive = true;
  return {
    title: 'My kingdom',
    mount(root) {
      setHtml(root, html`<section class="wrap page">${loading('Loading your kingdom…')}</section>`);
      void Promise.all([api.myProfile(), api.myMatches({ limit: 5 })])
        .then(([profile, recent]) => {
          if (!alive) return;
          render(root, profile, recent.matches);
        })
        .catch((error: Error) => alive && setHtml(root, html`<section class="wrap page">${errorBox(error.message)}</section>`));
    },
    destroy() {
      alive = false;
    }
  };
}

function render(root: HTMLElement, profile: ProfileResponse, recent: Parameters<typeof matchList>[0]) {
  const user = session.user!;
  const { displayName, password } = ACCOUNT_RULES;
  setHtml(
    root,
    html`<section class="wrap page">
      ${profileOverview(profile, html`<a class="btn btn-primary" href="/play">⚔️ Play</a>`)}

      <div class="panel">
        <div class="panel-head"><h2>📜 Recent battles</h2><a href="/history">All matches →</a></div>
        ${matchList(recent, user.id, 'No battles yet — your legend starts with the first one.')}
      </div>

      <div class="grid-2">
        <form class="panel form" data-profile-form novalidate>
          <div class="panel-head"><h2>🛡️ Edit profile</h2></div>
          <div class="alert alert-error" data-form-error hidden></div>
          <label class="field">
            <span>Display name</span>
            <input name="displayName" value="${user.displayName}" maxlength="${displayName.max}" required />
          </label>
          <div class="field"><span>Avatar</span>${avatarPicker('avatar', user.avatar)}</div>
          <button class="btn btn-primary" type="submit">Save changes</button>
        </form>

        <form class="panel form" data-password-form novalidate>
          <div class="panel-head"><h2>🔑 Change password</h2></div>
          <div class="alert alert-error" data-form-error hidden></div>
          <label class="field">
            <span>Current password</span>
            <input name="currentPassword" type="password" autocomplete="current-password" required />
          </label>
          <label class="field">
            <span>New password</span>
            <input name="newPassword" type="password" autocomplete="new-password" minlength="${password.min}" required />
            <small>At least ${password.min} characters. Other devices will be signed out.</small>
          </label>
          <label class="field">
            <span>Confirm new password</span>
            <input name="confirm" type="password" autocomplete="new-password" required />
          </label>
          <button class="btn btn-secondary" type="submit">Update password</button>
        </form>
      </div>
    </section>`
  );

  const profileForm = $<HTMLFormElement>(root, '[data-profile-form]');
  profileForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(profileForm);
    formError(profileForm, null);
    void withBusy(profileForm.querySelector('button'), async () => {
      try {
        const { user: updated } = await api.updateProfile({
          displayName: String(data.get('displayName') ?? ''),
          avatar: String(data.get('avatar') ?? user.avatar)
        });
        session.setUser(updated);
        $(root, '.profile-hero h1').textContent = updated.displayName;
        $(root, '.profile-hero .avatar').textContent = updated.avatar;
        toast('Profile updated.', 'success');
      } catch (error) {
        formError(profileForm, (error as Error).message);
      }
    });
  });

  const passwordForm = $<HTMLFormElement>(root, '[data-password-form]');
  passwordForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(passwordForm);
    const currentPassword = String(data.get('currentPassword') ?? '');
    const newPassword = String(data.get('newPassword') ?? '');
    if (newPassword.length < password.min) return formError(passwordForm, `New password must be at least ${password.min} characters.`);
    if (newPassword !== data.get('confirm')) return formError(passwordForm, 'New passwords do not match.');
    formError(passwordForm, null);
    void withBusy(passwordForm.querySelector('button'), async () => {
      try {
        await api.changePassword({ currentPassword, newPassword });
        passwordForm.reset();
        toast('Password updated.', 'success');
      } catch (error) {
        formError(passwordForm, (error as Error).message);
      }
    });
  });
}
