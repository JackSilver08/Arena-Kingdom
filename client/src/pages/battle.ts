import { DIFFICULTIES, type Difficulty } from '@arena-kingdom/shared';
import { toast } from '../components/ui';
import { GameController } from '../game/GameController';
import { DisplaySettingsPanel } from '../game/displaySettingsPanel';
import {
  LocalSession,
  OnlineSession,
  clearReconnectToken,
  describeJoinError,
  storedReconnectToken,
  takePendingSession,
  type GameSession
} from '../game/session';
import { html, setHtml } from '../lib/html';
import { navigate, type Page, type RouteContext } from '../lib/router';
import { session as auth } from '../lib/session';

export function battlePage(ctx: RouteContext): Page {
  let controller: GameController | null = null;
  let current: GameSession | null = null;
  let displaySettings: DisplaySettingsPanel | null = null;
  let alive = true;

  const requested = ctx.query.get('difficulty') as Difficulty | null;
  const difficulty: Difficulty = requested && DIFFICULTIES.includes(requested) ? requested : 'normal';
  const isAi = ctx.query.get('mode') === 'ai';

  return {
    title: 'Battle',
    layout: 'bare',
    mount(root) {
      const start = (gameSession: GameSession) => {
        current = gameSession;
        controller = new GameController(root, gameSession, {
          lobby: () => navigate('/play'),
          playAgain: () => navigate(isAi ? `/battle?mode=ai&difficulty=${difficulty}` : '/play', { replace: isAi })
        });
        displaySettings = new DisplaySettingsPanel(root, () => undefined);
      };

      if (isAi) {
        start(new LocalSession(difficulty));
        return;
      }

      const pending = takePendingSession();
      if (pending) {
        start(pending);
        return;
      }

      const token = storedReconnectToken();
      if (!token || !auth.signedIn) {
        queueMicrotask(() => navigate('/play', { replace: true }));
        return;
      }
      setHtml(root, html`<div class="battle-loading"><span class="spinner"></span><p>Rejoining your battle…</p></div>`);
      OnlineSession.reconnect(token)
        .then((gameSession) => {
          if (!alive) {
            gameSession.dispose();
            return;
          }
          start(gameSession);
        })
        .catch((error: unknown) => {
          if (!alive) return;
          clearReconnectToken();
          toast(`Could not rejoin the battle: ${describeJoinError(error)}`, 'error');
          navigate('/play', { replace: true });
        });
    },
    destroy() {
      alive = false;
      displaySettings?.destroy();
      controller?.destroy();
      current?.dispose();
    }
  };
}
