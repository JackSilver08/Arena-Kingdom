import { html, setHtml } from '../lib/html';
import type { Page } from '../lib/router';

export function notFoundPage(): Page {
  return {
    title: 'Not found',
    mount(root) {
      setHtml(
        root,
        html`<section class="wrap page not-found">
          <div class="empty">
            <div class="empty-icon">🗺️</div>
            <h1>This land is uncharted</h1>
            <p class="muted">The page you are looking for does not exist.</p>
            <a class="btn btn-primary" href="/">Return to the kingdom</a>
          </div>
        </section>`
      );
    }
  };
}
