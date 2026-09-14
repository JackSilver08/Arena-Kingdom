import { BUILDING_STATS, GAME_RULES, UNIT_STATS } from '@arena-kingdom/shared';
import { emptyState, errorBox, matchList, userLink } from '../components/ui';
import { api } from '../lib/api';
import { formatNumber } from '../lib/format';
import { $, html, setHtml } from '../lib/html';
import type { Page } from '../lib/router';
import { session } from '../lib/session';

export function homePage(): Page {
  let alive = true;
  return {
    title: '',
    mount(root) {
      const user = session.user;
      setHtml(
        root,
        html`<section class="hero wrap">
            <div class="eyebrow">⚔️ 2D real-time strategy · 1v1</div>
            <h1><span>Build Your Kingdom.</span><br />Break Theirs.</h1>
            <p class="hero-copy">
              A lightweight web-first strategy arena where economy, construction and troop command collide on one battlefield.
            </p>
            <div class="actions">
              <a class="btn btn-primary btn-lg" href="/play">Enter the battlefield</a>
              ${user
                ? html`<a class="btn btn-secondary btn-lg" href="/profile">${user.avatar} My kingdom</a>`
                : html`<a class="btn btn-secondary btn-lg" href="/register">Create a free account</a>`}
            </div>
            <dl class="live-stats" data-overview>
              <div><dt>Commanders</dt><dd data-stat="players">—</dd></div>
              <div><dt>Battles fought</dt><dd data-stat="matches">—</dd></div>
              <div><dt>Live right now</dt><dd><span class="live-dot"></span><span data-stat="online">—</span></dd></div>
            </dl>

            <div class="showcase" aria-label="Arena Kingdom battlefield preview">
              <div class="board">
                <div class="zone zone-blue">
                  <div class="piece piece-castle"><div class="icon">🏰</div><small>Blue castle</small></div>
                  <div class="piece-col">
                    <div class="piece"><div class="icon">🏠</div><small>Village</small></div>
                    <div class="piece"><div class="icon">⚔️</div><small>Barracks</small></div>
                  </div>
                  <div class="troops troops-blue"><i></i><i></i><i></i><i></i><i></i></div>
                </div>
                <div class="center"><div class="ring"><span>⚜️</span></div><b>Contested center</b></div>
                <div class="zone zone-red">
                  <div class="troops troops-red"><i></i><i></i><i></i><i></i></div>
                  <div class="piece-col">
                    <div class="piece"><div class="icon">🗼</div><small>Tower</small></div>
                    <div class="piece"><div class="icon">🏠</div><small>Village</small></div>
                  </div>
                  <div class="piece piece-castle"><div class="icon">🏰</div><small>Red castle</small></div>
                </div>
                <div class="matchup">One island · Two rulers · One throne</div>
              </div>
            </div>
          </section>

          <section class="wrap section">
            <div class="section-head">
              <h2>Choose your battle.</h2>
              <p>Sharpen your strategy against the computer, then prove it against real rulers.</p>
            </div>
            <div class="grid-3">
              <a class="card card-link" href="/play">
                <div class="card-emoji">🤖</div>
                <h3>Battle the AI</h3>
                <p>Three commanders — Squire, Knight and Warlord — each with their own build order and attack timing.</p>
                <span class="card-cta">Play offline →</span>
              </a>
              <a class="card card-link" href="/play">
                <div class="card-emoji">🏆</div>
                <h3>Ranked 1v1</h3>
                <p>Get matched with another ruler. Every result moves your Elo rating and your place on the leaderboard.</p>
                <span class="card-cta">Find a match →</span>
              </a>
              <a class="card card-link" href="/play">
                <div class="card-emoji">🔐</div>
                <h3>Private room</h3>
                <p>Create a room, share the code with a friend and settle the rivalry on your own island.</p>
                <span class="card-cta">Invite a friend →</span>
              </a>
            </div>
          </section>

          <section class="wrap section">
            <div class="section-head">
              <h2>Lightweight visuals. Deep decisions.</h2>
              <p>Every match begins with the same dilemma: invest in your kingdom, fortify the frontier, or force the first opening.</p>
            </div>
            <div class="grid-3">
              <article class="card">
                <div class="card-emoji">💰</div>
                <h3>Economy</h3>
                <p>
                  Villages cost ${BUILDING_STATS.village.cost} gold and pay +${GAME_RULES.economy.villageIncome} every
                  ${GAME_RULES.economy.incomeIntervalMs / 1000}s. Greed wins long games — if you survive them.
                </p>
              </article>
              <article class="card">
                <div class="card-emoji">🏗️</div>
                <h3>Kingdom building</h3>
                <p>Barracks train soldiers in parallel. Towers shoot anything that crosses into their range.</p>
              </article>
              <article class="card">
                <div class="card-emoji">⚔️</div>
                <h3>Real-time command</h3>
                <p>
                  Soldiers cost ${UNIT_STATS.soldier.cost} gold. Drag to select, right-click to attack, or send all, ⅓ or ⅔ of
                  your army in one order.
                </p>
              </article>
            </div>
          </section>

          <section class="wrap section">
            <div class="section-head">
              <h2>A few keys. A whole kingdom.</h2>
              <p>The command model is compact on purpose — depth comes from timing and trade-offs, not button clutter.</p>
            </div>
            <div class="grid-4">
              <article class="control"><span class="key">B</span><h3>Build</h3><p>Place a Village, Barracks or Tower inside your territory.</p></article>
              <article class="control"><span class="key">R</span><h3>Recruit</h3><p>Queue a soldier at your least busy barracks.</p></article>
              <article class="control"><span class="key">T</span><h3>Troops</h3><p>Send All, ⅓ or ⅔ of your army to any point.</p></article>
              <article class="control"><span class="key">M</span><h3>Messenger</h3><p>Propose peace or surrender. Diplomacy is a weapon too.</p></article>
            </div>
            <p class="center-note"><a href="/guide">Read the full guide →</a></p>
          </section>

          <section class="wrap section">
            <div class="grid-2">
              <div class="panel">
                <div class="panel-head"><h2>🏆 Top commanders</h2><a href="/leaderboard">Full leaderboard →</a></div>
                <div data-leaders><div class="skeleton-list"></div></div>
              </div>
              <div class="panel">
                <div class="panel-head">
                  <h2>📜 ${user ? 'Your recent battles' : 'Recent battles'}</h2>
                  ${user ? html`<a href="/history">Match history →</a>` : ''}
                </div>
                <div data-recent><div class="skeleton-list"></div></div>
              </div>
            </div>
          </section>

          <section class="wrap section">
            <div class="cta">
              <h2>The first throne is waiting.</h2>
              <p>Play instantly against the AI — no account needed. Sign up to keep your match history and climb the ranked ladder.</p>
              <div class="actions">
                <a class="btn btn-primary btn-lg" href="/play">Play now</a>
                <a class="btn btn-secondary btn-lg" href="/guide">How to play</a>
              </div>
            </div>
          </section>`
      );

      void api
        .overview()
        .then((stats) => {
          if (!alive) return;
          $(root, '[data-stat="players"]').textContent = formatNumber(stats.players);
          $(root, '[data-stat="matches"]').textContent = formatNumber(stats.matches);
          $(root, '[data-stat="online"]').textContent = `${stats.onlinePlayers} in ${stats.onlineRooms} room${stats.onlineRooms === 1 ? '' : 's'}`;
        })
        .catch(() => {
          if (alive) $(root, '[data-overview]').classList.add('offline');
        });

      const leaders = $(root, '[data-leaders]');
      void api
        .leaderboard(5)
        .then(({ entries }) => {
          if (!alive) return;
          setHtml(
            leaders,
            entries.length
              ? html`<ol class="leader-mini">
                  ${entries.map(
                    (e) => html`<li>
                      <span class="rank rank-${e.rank}">${e.rank}</span>
                      ${userLink(e.user)}
                      <span class="muted">${e.wins}W · ${e.losses}L</span>
                      <strong>${e.user.rating}</strong>
                    </li>`
                  )}
                </ol>`
              : emptyState('👑', 'No ranked battles yet. The throne is empty — claim it.')
          );
        })
        .catch((error: Error) => alive && setHtml(leaders, errorBox(error.message)));

      const recent = $(root, '[data-recent]');
      const request = user ? api.myMatches({ limit: 5 }) : api.recentMatches({ limit: 5 });
      void request
        .then(({ matches }) => {
          if (!alive) return;
          setHtml(
            recent,
            matchList(matches, user?.id, user ? 'You have not fought yet. Your first battle awaits.' : 'No battles recorded yet.')
          );
        })
        .catch((error: Error) => alive && setHtml(recent, errorBox(error.message)));
    },
    destroy() {
      alive = false;
    }
  };
}
