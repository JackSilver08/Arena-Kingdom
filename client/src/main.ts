import './styles.css';
import './game/displaySettings.css';
import { createLayout } from './components/layout';
import { restoreSession } from './lib/api';
import { navigate, startRouter, type Page, type RouteContext } from './lib/router';
import { session } from './lib/session';
import { authPage } from './pages/auth';
import { guidePage } from './pages/guide';
import { historyPage } from './pages/history';
import { homePage } from './pages/home';
import { leaderboardPage } from './pages/leaderboard';
import { matchPage } from './pages/match';
import { notFoundPage } from './pages/notFound';
import { playPage } from './pages/play';
import { playerPage } from './pages/player';
import { profilePage } from './pages/profile';

/** Sends guests to the sign-in page, returning them afterwards. */
function requireUser(load: (ctx: RouteContext) => Page) {
  return (ctx: RouteContext): Page => {
    if (session.signedIn) return load(ctx);
    const next = encodeURIComponent(ctx.path + (ctx.query.size ? `?${ctx.query}` : ''));
    queueMicrotask(() => navigate(`/login?next=${next}`, { replace: true }));
    return { title: 'Sign in', mount: () => undefined };
  };
}

async function boot() {
  const app = document.getElementById('app');
  if (!app) return;
  const renderPage = createLayout(app);
  await restoreSession();

  startRouter(
    [
      { pattern: '/', load: homePage },
      { pattern: '/play', load: playPage },
      { pattern: '/battle', load: async (ctx) => (await import('./pages/battle')).battlePage(ctx) },
      { pattern: '/login', load: (ctx) => authPage(ctx, 'login') },
      { pattern: '/register', load: (ctx) => authPage(ctx, 'register') },
      { pattern: '/profile', load: requireUser(profilePage) },
      { pattern: '/history', load: requireUser(historyPage) },
      { pattern: '/matches/:id', load: matchPage },
      { pattern: '/players/:username', load: playerPage },
      { pattern: '/leaderboard', load: leaderboardPage },
      { pattern: '/guide', load: guidePage }
    ],
    notFoundPage,
    renderPage
  );
}

void boot();
