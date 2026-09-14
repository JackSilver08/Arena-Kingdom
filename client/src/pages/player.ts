import { errorBox, loading } from '../components/ui';
import { api } from '../lib/api';
import { $, html, setHtml } from '../lib/html';
import type { Page, RouteContext } from '../lib/router';
import { session } from '../lib/session';
import { mountMatchHistory } from './history';
import { profileOverview } from './profile';

export function playerPage(ctx: RouteContext): Page {
  let alive = true;
  const username = ctx.params.username;
  return {
    title: username,
    mount(root) {
      setHtml(root, html`<section class="wrap page">${loading('Loading player…')}</section>`);
      api
        .profile(username)
        .then((profile) => {
          if (!alive) return;
          document.title = `${profile.user.displayName} · Arena Kingdom`;
          const isMe = session.user?.id === profile.user.id;
          setHtml(
            root,
            html`<section class="wrap page">
              ${profileOverview(profile, isMe ? html`<a class="btn btn-secondary" href="/profile">Edit profile</a>` : undefined)}
              <div class="panel">
                <div class="panel-head"><h2>📜 Battles</h2></div>
                <div data-history></div>
              </div>
            </section>`
          );
          mountMatchHistory($(root, '[data-history]'), {
            fetch: (params) => api.userMatches(profile.user.username, params),
            perspectiveUserId: profile.user.id,
            mode: 'all',
            emptyText: `${profile.user.displayName} has not fought any battles yet.`
          });
        })
        .catch((error: Error) => alive && setHtml(root, html`<section class="wrap page">${errorBox(error.message)}</section>`));
    },
    destroy() {
      alive = false;
    }
  };
}
