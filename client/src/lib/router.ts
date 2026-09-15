export interface RouteContext {
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
}

export interface Page {
  title: string;
  /** `bare` hides the site navigation (used by the battle screen); `landing` overlays it on a full-bleed page with its own footer. */
  layout?: 'site' | 'bare' | 'landing';
  mount(root: HTMLElement): void;
  destroy?(): void;
}

export interface Route {
  pattern: string;
  load: (ctx: RouteContext) => Page | Promise<Page>;
}

interface CompiledRoute extends Route {
  regex: RegExp;
  keys: string[];
}

type Renderer = (page: Page, ctx: RouteContext) => void;

let compiled: CompiledRoute[] = [];
let render: Renderer = () => undefined;
let fallback: Route['load'] = () => ({ title: 'Not found', mount: () => undefined });
let navigationId = 0;

function compile(route: Route): CompiledRoute {
  const keys: string[] = [];
  const source = route.pattern
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        keys.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { ...route, regex: new RegExp(`^${source}/?$`), keys };
}

async function resolve() {
  const id = ++navigationId;
  const url = new URL(window.location.href);
  const ctx: RouteContext = { path: url.pathname, params: {}, query: url.searchParams };
  let load = fallback;
  for (const route of compiled) {
    const match = route.regex.exec(url.pathname);
    if (!match) continue;
    route.keys.forEach((key, i) => {
      ctx.params[key] = decodeURIComponent(match[i + 1]);
    });
    load = route.load;
    break;
  }
  const page = await load(ctx);
  if (id === navigationId) render(page, ctx);
}

export function navigate(to: string, options: { replace?: boolean } = {}) {
  const target = new URL(to, window.location.href);
  if (target.origin !== window.location.origin) {
    window.location.href = to;
    return;
  }
  const next = target.pathname + target.search + target.hash;
  if (options.replace) history.replaceState(null, '', next);
  else if (next !== window.location.pathname + window.location.search + window.location.hash) history.pushState(null, '', next);
  void resolve().then(() => {
    if (!target.hash) window.scrollTo({ top: 0 });
  });
}

export function refresh() {
  void resolve();
}

export function startRouter(routes: Route[], notFound: Route['load'], renderer: Renderer) {
  compiled = routes.map(compile);
  fallback = notFound;
  render = renderer;
  window.addEventListener('popstate', () => void resolve());
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element | null)?.closest('a');
    if (!anchor || anchor.target || anchor.hasAttribute('download') || anchor.dataset.external !== undefined) return;
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return;
    event.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  });
  void resolve();
}
