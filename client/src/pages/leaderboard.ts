import { emptyState, errorBox, loading, userLink } from '../components/ui';
import { api } from '../lib/api';
import { winRate } from '../lib/format';
import { html, setHtml } from '../lib/html';
import type { Page } from '../lib/router';
import { session } from '../lib/session';

export function leaderboardPage(): Page {
  let alive = true;
  return {
    title: 'Leaderboard',
    mount(root) {
      setHtml(
        root,
        html`<section class="wrap page">
          <div class="page-head">
            <div>
              <h1>🏆 Leaderboard</h1>
              <p class="muted">Rulers ranked by Elo rating from ranked 1v1 battles. Everyone starts at 1000.</p>
            </div>
            <a class="btn btn-primary" href="/play">Climb the ladder</a>
          </div>
          <div class="panel" data-board>${loading()}</div>
        </section>`
      );
      const board = root.querySelector<HTMLElement>('[data-board]')!;
      api
        .leaderboard(100)
        .then(({ entries }) => {
          if (!alive) return;
          if (!entries.length) {
            setHtml(
              board,
              emptyState('👑', 'No ranked battles have been fought yet. Be the first name on the board.', html`<a class="btn btn-primary" href="/play">Find a ranked match</a>`)
            );
            return;
          }
          const me = session.user?.id;
          setHtml(
            board,
            html`<div class="table-scroll">
              <table class="table leaderboard">
                <thead>
                  <tr><th>#</th><th>Ruler</th><th>Rating</th><th>Played</th><th>W / L / D</th><th>Win rate</th></tr>
                </thead>
                <tbody>
                  ${entries.map(
                    (e) => html`<tr class="${e.user.id === me ? 'is-me' : ''}">
                      <td><span class="rank rank-${e.rank}">${e.rank}</span></td>
                      <td>${userLink(e.user)}</td>
                      <td><strong>${e.user.rating}</strong></td>
                      <td>${e.played}</td>
                      <td>${e.wins} / ${e.losses} / ${e.draws}</td>
                      <td>${winRate(e.wins, e.played)}</td>
                    </tr>`
                  )}
                </tbody>
              </table>
            </div>`
          );
        })
        .catch((error: Error) => alive && setHtml(board, errorBox(error.message)));
    },
    destroy() {
      alive = false;
    }
  };
}
