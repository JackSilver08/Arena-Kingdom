import type { MatchListResponse, MatchMode } from '@arena-kingdom/shared';
import { errorBox, loading, matchList } from '../components/ui';
import { api } from '../lib/api';
import { $, html, setHtml } from '../lib/html';
import type { Page, RouteContext } from '../lib/router';
import { session } from '../lib/session';

const PAGE_SIZE = 15;
const TABS: { key: MatchMode | 'all'; label: string }[] = [
  { key: 'all', label: 'All battles' },
  { key: 'pvp', label: '⚔️ Online' },
  { key: 'ai', label: '🤖 vs AI' }
];

/** Paginated match history; used for your own history and for public player pages. */
export function mountMatchHistory(
  container: HTMLElement,
  options: {
    fetch: (params: { mode?: MatchMode; limit: number; offset: number }) => Promise<MatchListResponse>;
    perspectiveUserId: number | null;
    mode: MatchMode | 'all';
    onModeChange?: (mode: MatchMode | 'all') => void;
    emptyText: string;
  }
) {
  let mode = options.mode;
  let offset = 0;
  let loaded: MatchListResponse['matches'] = [];
  let request = 0;

  setHtml(
    container,
    html`<div class="tabs" role="tablist">
        ${TABS.map(
          (tab) => html`<button type="button" role="tab" class="tab" data-mode="${tab.key}" aria-selected="${tab.key === mode}">
            ${tab.label}
          </button>`
        )}
      </div>
      <p class="muted history-count" data-count></p>
      <div data-list>${loading()}</div>
      <div class="center-note"><button class="btn btn-secondary" type="button" data-more hidden>Load more</button></div>`
  );
  const list = $(container, '[data-list]');
  const more = $<HTMLButtonElement>(container, '[data-more]');
  const count = $(container, '[data-count]');

  async function load(reset: boolean) {
    const id = ++request;
    if (reset) {
      offset = 0;
      loaded = [];
      setHtml(list, loading());
    }
    more.disabled = true;
    try {
      const result = await options.fetch({ mode: mode === 'all' ? undefined : mode, limit: PAGE_SIZE, offset });
      if (id !== request || !container.isConnected) return;
      loaded = loaded.concat(result.matches);
      offset = loaded.length;
      setHtml(list, matchList(loaded, options.perspectiveUserId, options.emptyText));
      count.textContent = result.total ? `${result.total} battle${result.total === 1 ? '' : 's'}` : '';
      more.hidden = loaded.length >= result.total;
    } catch (error) {
      if (id === request) setHtml(list, errorBox((error as Error).message));
    } finally {
      more.disabled = false;
    }
  }

  container.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      mode = button.dataset.mode as MatchMode | 'all';
      container.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b === button)));
      options.onModeChange?.(mode);
      void load(true);
    });
  });
  more.addEventListener('click', () => void load(false));
  void load(true);
}

export function historyPage(ctx: RouteContext): Page {
  const initial = ctx.query.get('mode');
  return {
    title: 'Match history',
    mount(root) {
      const user = session.user!;
      setHtml(
        root,
        html`<section class="wrap page">
          <div class="page-head">
            <div>
              <h1>Match history</h1>
              <p class="muted">Every battle you have fought, win or lose. Ranked and AI matches are saved automatically.</p>
            </div>
            <a class="btn btn-primary" href="/play">⚔️ New battle</a>
          </div>
          <div class="panel" data-history></div>
        </section>`
      );
      mountMatchHistory($(root, '[data-history]'), {
        fetch: (params) => api.myMatches(params),
        perspectiveUserId: user.id,
        mode: initial === 'ai' || initial === 'pvp' ? initial : 'all',
        // Keep the URL shareable without re-rendering the page.
        onModeChange: (mode) => history.replaceState(null, '', mode === 'all' ? '/history' : `/history?mode=${mode}`),
        emptyText: 'No battles here yet. Head to the battlefield!'
      });
    }
  };
}
