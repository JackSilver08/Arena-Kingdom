import { api } from '../lib/api';
import { $, html, setHtml } from '../lib/html';
import { navigate, type Page, type RouteContext } from '../lib/router';
import { session } from '../lib/session';
import { avatar, toast } from './ui';

const NAV_LINKS = [
  { href: '/play', label: 'Play' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/guide', label: 'How to play' }
];

export function createLayout(app: HTMLElement) {
  setHtml(
    app,
    html`<header class="site-header">
        <div class="wrap nav">
          <a class="brand" href="/" aria-label="Arena Kingdom home"><span class="crest">🏰</span><span>ARENA KINGDOM</span></a>
          <button class="nav-toggle" type="button" aria-label="Menu" aria-expanded="false">☰</button>
          <nav class="nav-links" data-nav></nav>
        </div>
      </header>
      <main id="page" tabindex="-1"></main>
      <footer class="site-footer wrap">
        <span>© 2026 Arena Kingdom · v0.2</span>
        <span>Web-first · 2D · Real-time · 1v1</span>
      </footer>`
  );

  const nav = $(app, '[data-nav]');
  const toggle = $<HTMLButtonElement>(app, '.nav-toggle');
  const outlet = $(app, '#page');
  let current: Page | null = null;
  let currentPath = '';

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  function renderNav() {
    const user = session.user;
    const links = NAV_LINKS.map(
      (link) => html`<a href="${link.href}" class="${currentPath.startsWith(link.href) ? 'active' : ''}">${link.label}</a>`
    );
    const account = user
      ? html`<div class="nav-account">
          <a href="/history" class="${currentPath === '/history' ? 'active' : ''}">History</a>
          <a class="nav-user" href="/profile">${avatar(user.avatar, 'sm')}<span>${user.displayName}</span><small>${user.rating}</small></a>
          <button type="button" class="btn btn-ghost btn-sm" data-logout>Sign out</button>
        </div>`
      : html`<div class="nav-account">
          <a href="/login" class="${currentPath === '/login' ? 'active' : ''}">Sign in</a>
          <a class="btn btn-primary btn-sm" href="/register">Create account</a>
        </div>`;
    setHtml(nav, html`${links}${account}`);
    nav.querySelector('[data-logout]')?.addEventListener('click', async () => {
      await api.logout().catch(() => undefined);
      session.clear();
      toast('Signed out. See you on the battlefield.');
      navigate('/');
    });
  }

  session.subscribe(renderNav);
  nav.addEventListener('click', (event) => {
    if ((event.target as Element).closest('a')) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  return function renderPage(page: Page, ctx: RouteContext) {
    current?.destroy?.();
    current = page;
    currentPath = ctx.path;
    document.title = page.title ? `${page.title} · Arena Kingdom` : 'Arena Kingdom';
    document.body.classList.toggle('is-bare', page.layout === 'bare');
    document.body.classList.toggle('is-landing', page.layout === 'landing');
    renderNav();
    outlet.replaceChildren();
    page.mount(outlet);
  };
}
