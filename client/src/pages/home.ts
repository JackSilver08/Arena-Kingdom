import {
  DIFFICULTY_LABELS,
  GAME_RULES,
  startingLayout,
  type BuildingType,
  type LeaderboardEntry,
  type MatchSummary,
  type Side
} from '@arena-kingdom/shared';
import {
  SPRITE_ANCHOR_Y,
  SPRITE_SIZE,
  barracksArt,
  bigWaveArt,
  castleArt,
  envelopeIcon,
  moneyBagIcon,
  svgDataUrl,
  towerArt,
  troopArt
} from '../game/art';
import { arenaMapArtV2 } from '../game/mapArt';
import { villageArt } from '../game/villageArt';
import { api } from '../lib/api';
import { formatNumber, timeAgo } from '../lib/format';
import { $, html, setHtml, trusted, type SafeHtml } from '../lib/html';
import type { Page } from '../lib/router';
import { session } from '../lib/session';

const GITHUB_URL = 'https://github.com/JackSilver08/Arena-Kingdom';
const WORLD = { width: 1920, height: 1080 };

const CREST = trusted(
  `<svg class="ak-crest" viewBox="0 -16 132 118" aria-hidden="true" focusable="false"><g fill="currentColor" transform="skewX(-7) translate(14 0)"><path fill-rule="evenodd" d="M6 86V24h6v6h5v-6h6v6h5v-6h6v16h4V6h8v7h10V6h8v7h10V6h8v34h4V24h6v6h5v-6h6v6h5v-6h6v62zM50 86V70a10 10 0 0 1 20 0v16zM18 46h4v14h-4zM98 46h4v14h-4zM57 24h6v14h-6z"/><path d="M59-14h2v20h-2zM61-14h15l-4 5 4 5H61z"/><path d="M0 92h120v8H0z"/></g></svg>`
);

const GITHUB_ICON = trusted(
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57v-2.04c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .3"/></svg>`
);

// ------------------------------------------------------------------ artwork

const dataUrls = new Map<string, string>();

function artUrl(markup: string, width: number, height: number) {
  let url = dataUrls.get(markup);
  if (!url) {
    url = svgDataUrl(markup, width, height);
    dataUrls.set(markup, url);
  }
  return url;
}

/** An SVG sprite placed inside a scene; `style` positions it in percent of the scene. */
function sprite(markup: string, width: number, height: number, style: string) {
  return html`<img class="ak-sprite" src="${artUrl(markup, width, height)}" alt="" style="${style}" />`;
}

function buildingMarkup(type: BuildingType, side: Side) {
  if (type === 'village') return villageArt(side);
  if (type === 'barracks') return barracksArt(side);
  if (type === 'tower') return towerArt(side);
  return castleArt(side);
}

/** The real starting battlefield: the island with every opening building and troop, drawn at `scale`. */
function battlefield(scale: number) {
  const place = (type: BuildingType | 'troop', markup: string, x: number, y: number) => {
    const size = SPRITE_SIZE[type];
    return sprite(
      markup,
      size.width,
      size.height,
      `left:${(x / WORLD.width) * 100}%;top:${(y / WORLD.height) * 100}%;width:${((size.width * scale) / WORLD.width) * 100}%;transform:translate(-50%,-${SPRITE_ANCHOR_Y[type] * 100}%)`
    );
  };
  const sides: Side[] = ['blue', 'red'];
  return html`<img class="ak-map" src="${artUrl(arenaMapArtV2(), WORLD.width, WORLD.height)}" alt="" />
    ${sides.map((side) => {
      const layout = startingLayout(side);
      return html`${layout.buildings.map((b) => place(b.type, buildingMarkup(b.type, side), b.x, b.y))}
      ${layout.units.map((u) => place('troop', troopArt(side), u.x, u.y))}`;
    })}`;
}

const scene = (tone: string, body: SafeHtml | SafeHtml[]) => html`<div class="ak-scene ak-scene-${tone}">${body}</div>`;

const waves = () => sprite(bigWaveArt(), 380, 180, 'left:-10%;top:4%;width:120%;opacity:.12');

function versusScene(winner?: Side) {
  return scene(
    'versus',
    html`<div class="ak-versus ${winner ? `win-${winner}` : ''}">
      ${sprite(castleArt('blue'), 120, 116, 'left:6%;bottom:12%;width:40%')}
      <b>VS</b>
      ${sprite(castleArt('red'), 120, 116, 'right:6%;bottom:12%;width:40%')}
    </div>`
  );
}

// --------------------------------------------------------------------- news

interface NewsItem {
  icon: string;
  tag: string;
  title: string;
  href: string;
  thumb: SafeHtml;
}

function staticNews(): NewsItem[] {
  const { economy } = GAME_RULES;
  return [
    {
      icon: '🔥',
      tag: 'AI commander',
      title: `${DIFFICULTY_LABELS.hard}: early pressure, reinforcements and tactical retreats`,
      href: '/play',
      thumb: scene('ember', [
        sprite(castleArt('red'), 120, 116, 'left:30%;bottom:10%;width:44%'),
        sprite(towerArt('red'), 48, 74, 'left:8%;bottom:10%;width:18%'),
        sprite(towerArt('red'), 48, 74, 'right:4%;bottom:10%;width:18%')
      ])
    },
    {
      icon: '💰',
      tag: 'Guide',
      title: `Economy 101: every village pays +${economy.villageIncome} gold every ${economy.incomeIntervalMs / 1000}s`,
      href: '/guide',
      thumb: scene('meadow', [
        sprite(villageArt('blue'), 96, 74, 'left:8%;bottom:12%;width:58%'),
        sprite(moneyBagIcon(), 48, 48, 'right:8%;bottom:16%;width:24%')
      ])
    },
    {
      icon: '🏝️',
      tag: 'Map',
      title: 'One island, two kingdoms: no bridges, the whole front is open',
      href: '/guide',
      thumb: scene('map-zoom', battlefield(1.5))
    },
    {
      icon: '🏆',
      tag: 'Ranked',
      title: 'Ranked 1v1: every result moves your Elo rating',
      href: '/leaderboard',
      thumb: versusScene()
    }
  ];
}

function matchNews(match: MatchSummary): NewsItem {
  const winner = match.players.find((p) => p.outcome === 'win');
  const loser = match.players.find((p) => p !== winner);
  const blue = match.players.find((p) => p.side === 'blue');
  const red = match.players.find((p) => p.side === 'red');
  const title =
    winner && loser
      ? `${winner.displayName} defeated ${loser.displayName}`
      : `${blue?.displayName ?? 'Blue'} and ${red?.displayName ?? 'Red'} fought to a draw`;
  const mode =
    match.mode === 'ai'
      ? { icon: '🤖', label: `vs AI · ${match.difficulty ? DIFFICULTY_LABELS[match.difficulty] : 'Unknown'}` }
      : match.rated
        ? { icon: '⚔️', label: 'Ranked 1v1' }
        : { icon: '🤝', label: 'Friendly 1v1' };
  return {
    icon: mode.icon,
    tag: `${mode.label} · ${timeAgo(match.endedAt)}`,
    title,
    href: `/matches/${encodeURIComponent(match.id)}`,
    thumb: versusScene(winner?.side)
  };
}

const newsTag = (icon: string, label: string) =>
  html`<span class="ak-news-tag"><i aria-hidden="true">${icon}</i><span>${label}</span></span>`;

const newsCard = (item: NewsItem) => html`<a class="ak-news-card" href="${item.href}">
  <div class="ak-news-body"><h3>${item.title}</h3>${newsTag(item.icon, item.tag)}</div>
  <div class="ak-news-thumb">${item.thumb}</div>
</a>`;

// -------------------------------------------------------------------- modes

interface ModeCard {
  key: string;
  title: string;
  kicker: string;
  text: string;
  meta: string;
  href: string;
  art: SafeHtml;
  featured?: boolean;
}

function modeCards(rating: number | null): ModeCard[] {
  return [
    {
      key: 'easy',
      title: DIFFICULTY_LABELS.easy,
      kicker: 'vs AI · Easy',
      text: 'Builds slowly and attacks late. Perfect for learning the controls.',
      meta: 'Instant · Offline',
      href: '/battle?mode=ai&difficulty=easy',
      art: scene('meadow', [
        waves(),
        sprite(villageArt('blue'), 96, 74, 'left:10%;bottom:24%;width:80%'),
        sprite(troopArt('blue'), 26, 36, 'left:22%;bottom:12%;width:11%'),
        sprite(troopArt('blue'), 26, 36, 'left:40%;bottom:9%;width:11%')
      ])
    },
    {
      key: 'normal',
      title: DIFFICULTY_LABELS.normal,
      kicker: 'vs AI · Normal',
      text: 'A balanced economy and real attack waves around the two-minute mark.',
      meta: 'Instant · Offline',
      href: '/battle?mode=ai&difficulty=normal',
      art: scene('dusk', [
        waves(),
        sprite(barracksArt('blue'), 66, 62, 'left:14%;bottom:26%;width:72%'),
        sprite(troopArt('blue'), 26, 36, 'left:16%;bottom:10%;width:12%'),
        sprite(troopArt('blue'), 26, 36, 'left:36%;bottom:8%;width:12%'),
        sprite(troopArt('blue'), 26, 36, 'left:56%;bottom:10%;width:12%')
      ])
    },
    {
      key: 'ranked',
      title: 'Ranked 1v1',
      kicker: 'Online · Elo ladder',
      text: 'Get matched with another ruler. Every result moves your rating and your place on the ladder.',
      meta: rating === null ? 'Account required' : `Your rating · ${rating}`,
      href: '/play',
      featured: true,
      art: scene('versus-tall', [
        waves(),
        sprite(castleArt('blue'), 120, 116, 'left:11%;top:28%;width:52%'),
        sprite(castleArt('red'), 120, 116, 'right:12%;bottom:12%;width:52%'),
        html`<b class="ak-vs-mark" aria-hidden="true">VS</b>`
      ])
    },
    {
      key: 'hard',
      title: DIFFICULTY_LABELS.hard,
      kicker: 'vs AI · Hard',
      text: 'Greedy economy, early pressure and tactical retreats. Bring a plan.',
      meta: 'Instant · Offline',
      href: '/battle?mode=ai&difficulty=hard',
      art: scene('ember', [
        waves(),
        sprite(castleArt('red'), 120, 116, 'left:16%;bottom:26%;width:68%'),
        sprite(towerArt('red'), 48, 74, 'left:2%;bottom:18%;width:22%'),
        sprite(towerArt('red'), 48, 74, 'right:2%;bottom:18%;width:22%'),
        sprite(troopArt('red'), 26, 36, 'left:20%;bottom:6%;width:11%'),
        sprite(troopArt('red'), 26, 36, 'left:44%;bottom:4%;width:11%'),
        sprite(troopArt('red'), 26, 36, 'left:68%;bottom:6%;width:11%')
      ])
    },
    {
      key: 'private',
      title: 'Private room',
      kicker: 'Online · Friends',
      text: 'Create a room, share the code with a friend and settle the rivalry.',
      meta: 'Friendly · Unrated',
      href: '/play',
      art: scene('gold', [
        waves(),
        sprite(envelopeIcon(), 100, 100, 'left:18%;bottom:30%;width:64%'),
        sprite(troopArt('blue'), 26, 36, 'left:12%;bottom:12%;width:14%'),
        sprite(troopArt('red'), 26, 36, 'right:12%;bottom:12%;width:14%')
      ])
    }
  ];
}

const modeCard = (mode: ModeCard) => html`<a
  class="ak-mode ak-mode-${mode.key} ${mode.featured ? 'is-featured' : ''}"
  href="${mode.href}"
>
  <div class="ak-mode-art">${mode.art}</div>
  <div class="ak-mode-logo"><strong>${mode.title}</strong><small>${mode.kicker}</small></div>
  <div class="ak-mode-foot">
    <p>${mode.text}</p>
    <span class="ak-mode-meta">${mode.meta}</span>
  </div>
</a>`;

// --------------------------------------------------------------------- hall

function hallCard(entry: LeaderboardEntry) {
  const tier = entry.rank <= 3 ? `top-${entry.rank}` : entry.rank % 2 ? 'blue' : 'red';
  return html`<a class="ak-hall-card tier-${tier}" href="/players/${encodeURIComponent(entry.user.username)}">
    <span class="ak-hall-rank" aria-hidden="true">${entry.rank}</span>
    <span class="ak-hall-avatar" aria-hidden="true">${entry.user.avatar}</span>
    <strong>${entry.user.displayName}</strong>
    <small>${entry.user.rating} Elo · ${entry.wins}W ${entry.losses}L</small>
  </a>`;
}

function hallPlaceholders(text: string) {
  return [1, 2, 3, 4].map(
    (rank) => html`<a class="ak-hall-card tier-empty" href="/play">
      <span class="ak-hall-rank" aria-hidden="true">${rank}</span>
      <span class="ak-hall-avatar" aria-hidden="true">${rank === 1 ? '👑' : '🛡️'}</span>
      <strong>Unclaimed</strong>
      <small>${text}</small>
    </a>`
  );
}

// --------------------------------------------------------------------- page

export function homePage(): Page {
  let alive = true;
  const cleanups: (() => void)[] = [];

  return {
    title: '',
    layout: 'landing',
    mount(root) {
      const user = session.user;
      setHtml(
        root,
        html`<div class="landing">
          <section class="ak-hero">
            <div class="ak-hero-inner">
              <h1 class="ak-logo">
                <span class="ak-sr">Arena Kingdom</span>
                ${CREST}
                <span class="ak-wordmark" aria-hidden="true"><span>Arena</span><span>Kingdom</span></span>
              </h1>
              <p class="ak-hero-tag">Build your kingdom. Break theirs.</p>
              <div class="ak-hero-actions">
                <a class="ak-pill ak-pill-light" href="/play">Play free</a>
                <a class="ak-pill ak-pill-outline" href="/guide">How to play</a>
              </div>
            </div>
          </section>

          <section class="ak-section ak-news-section">
            <div class="ak-wrap">
              <div class="ak-head">
                <h2>What's happening?</h2>
                <a class="ak-more" href="${user ? '/history' : '/leaderboard'}">See more</a>
              </div>
              <div class="ak-news">
                <a class="ak-feature" href="/guide">
                  <div class="ak-feature-media">${scene('map', battlefield(1.7))}</div>
                  <h3>One Island: the new battlefield is live</h3>
                  ${newsTag('🏝️', 'Update')}
                </a>
                <div class="ak-news-list" data-news>${staticNews().map(newsCard)}</div>
              </div>
            </div>
          </section>

          <div class="ak-lore">
            <section class="ak-section ak-modes-section">
              <div class="ak-wrap ak-head"><h2>Choose your battle</h2></div>
              <div class="ak-modes">${modeCards(user?.rating ?? null).map(modeCard)}</div>
            </section>

            <section class="ak-section ak-hall-section">
              <div class="ak-wrap ak-head">
                <h2>Hall of Commanders</h2>
                <div class="ak-arrows">
                  <button type="button" data-hall-prev aria-label="Previous commanders">←</button>
                  <span aria-hidden="true"></span>
                  <button type="button" data-hall-next aria-label="Next commanders">→</button>
                </div>
              </div>
              <div class="ak-hall" data-hall aria-label="Top commanders">
                ${[1, 2, 3, 4].map(() => html`<div class="ak-hall-card is-loading"></div>`)}
              </div>
            </section>
          </div>

          <section class="ak-throne">
            <div class="ak-throne-copy">
              <h2>Your throne is waiting!</h2>
              <p>Play instantly against the AI — no account needed. Sign up to keep your battles and climb the ranked ladder.</p>
              <div class="ak-stats" data-overview>
                <div class="ak-stat"><strong data-stat="players">—</strong><span>Commanders</span></div>
                <div class="ak-stat"><strong data-stat="matches">—</strong><span>Battles fought</span></div>
              </div>
              <p class="ak-live" data-live hidden><span class="ak-live-dot"></span><span data-stat="online"></span></p>
              <a class="ak-pill ak-pill-red ak-pill-lg" href="/play">Enter the battlefield</a>
              ${user ? '' : html`<a class="ak-throne-alt" href="/register">or create a free account</a>`}
            </div>
            <div class="ak-throne-art">${scene('night', battlefield(2.4))}</div>
          </section>

          <footer class="ak-footer">
            <div class="ak-footer-top">
              <a class="ak-footer-logo" href="/" aria-label="Arena Kingdom home">${CREST}</a>
              <nav class="ak-footer-links" aria-label="Footer">
                <a href="/play">Play</a>
                <a href="/leaderboard">Leaderboard</a>
                <a href="/guide">How to play</a>
                ${user
                  ? html`<a href="/history">Match history</a><a href="/profile">Profile</a>`
                  : html`<a href="/login">Sign in</a><a href="/register">Create account</a>`}
              </nav>
              <div class="ak-social">
                <a href="${GITHUB_URL}" target="_blank" rel="noreferrer" aria-label="Arena Kingdom on GitHub">${GITHUB_ICON}</a>
              </div>
            </div>
            <div class="ak-footer-bottom">
              <span>© 2026 Arena Kingdom · v0.2</span>
              <span class="ak-footer-sep" aria-hidden="true"></span>
              <span>Web-first · 2D · Real-time · 1v1</span>
              <button type="button" class="ak-surface" data-top>To the surface ▲</button>
            </div>
          </footer>
        </div>`
      );

      const onScroll = () => document.body.classList.toggle('is-scrolled', window.scrollY > 24);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      cleanups.push(() => {
        window.removeEventListener('scroll', onScroll);
        document.body.classList.remove('is-scrolled');
      });

      $(root, '[data-top]').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

      const hall = $(root, '[data-hall]');
      const prev = $<HTMLButtonElement>(root, '[data-hall-prev]');
      const next = $<HTMLButtonElement>(root, '[data-hall-next]');
      const updateArrows = () => {
        prev.disabled = hall.scrollLeft <= 4;
        next.disabled = hall.scrollLeft + hall.clientWidth >= hall.scrollWidth - 4;
      };
      prev.addEventListener('click', () => hall.scrollBy({ left: -hall.clientWidth * 0.8, behavior: 'smooth' }));
      next.addEventListener('click', () => hall.scrollBy({ left: hall.clientWidth * 0.8, behavior: 'smooth' }));
      hall.addEventListener('scroll', updateArrows, { passive: true });
      const resize = new ResizeObserver(updateArrows);
      resize.observe(hall);
      cleanups.push(() => resize.disconnect());

      void api
        .overview()
        .then((stats) => {
          if (!alive) return;
          $(root, '[data-stat="players"]').textContent = formatNumber(stats.players);
          $(root, '[data-stat="matches"]').textContent = formatNumber(stats.matches);
          $(root, '[data-stat="online"]').textContent = stats.onlinePlayers
            ? `${stats.onlinePlayers} playing in ${stats.onlineRooms} room${stats.onlineRooms === 1 ? '' : 's'} right now`
            : 'The arena is open — be the first on the battlefield';
          $(root, '[data-live]').hidden = false;
        })
        .catch(() => {
          if (alive) $(root, '[data-overview]').classList.add('offline');
        });

      void api
        .leaderboard(10)
        .then(({ entries }) => {
          if (!alive) return;
          setHtml(hall, html`${entries.length ? entries.map(hallCard) : hallPlaceholders('Win a ranked match to claim it')}`);
          updateArrows();
        })
        .catch(() => {
          if (!alive) return;
          setHtml(hall, html`${hallPlaceholders('Leaderboard offline')}`);
          updateArrows();
        });

      void api
        .recentMatches({ limit: 4 })
        .then(({ matches }) => {
          if (!alive || !matches.length) return;
          const items = [...matches.map(matchNews), ...staticNews()].slice(0, 4);
          setHtml($(root, '[data-news]'), html`${items.map(newsCard)}`);
        })
        .catch(() => undefined);
    },
    destroy() {
      alive = false;
      cleanups.forEach((cleanup) => cleanup());
    }
  };
}
