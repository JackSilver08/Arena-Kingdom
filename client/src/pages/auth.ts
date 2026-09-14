import { ACCOUNT_RULES, AVATARS } from '@arena-kingdom/shared';
import { formError, toast, withBusy } from '../components/ui';
import { api } from '../lib/api';
import { $, html, setHtml } from '../lib/html';
import { navigate, type Page, type RouteContext } from '../lib/router';
import { session } from '../lib/session';

function safeNext(ctx: RouteContext) {
  const next = ctx.query.get('next') ?? '';
  // Only allow same-site paths to avoid open redirects.
  return next.startsWith('/') && !next.startsWith('//') ? next : '/play';
}

export function avatarPicker(name: string, selected: string) {
  return html`<div class="avatar-picker" role="radiogroup" aria-label="Avatar">
    ${AVATARS.map(
      (emoji) => html`<label class="avatar-option">
        <input type="radio" name="${name}" value="${emoji}" ${selected === emoji ? html`checked` : ''} />
        <span>${emoji}</span>
      </label>`
    )}
  </div>`;
}

export function authPage(ctx: RouteContext, mode: 'login' | 'register'): Page {
  const next = safeNext(ctx);
  return {
    title: mode === 'login' ? 'Sign in' : 'Create account',
    mount(root) {
      if (session.signedIn) {
        queueMicrotask(() => navigate(next, { replace: true }));
        return;
      }
      const isLogin = mode === 'login';
      const nextQuery = ctx.query.get('next') ? `?next=${encodeURIComponent(next)}` : '';
      const { username, password, displayName } = ACCOUNT_RULES;
      setHtml(
        root,
        html`<section class="auth wrap">
          <div class="auth-card">
            <div class="auth-crest">🏰</div>
            <h1>${isLogin ? 'Welcome back, ruler' : 'Found your kingdom'}</h1>
            <p class="muted">
              ${isLogin
                ? 'Sign in to play ranked matches and keep your battle history.'
                : 'An account saves every battle, tracks your stats and puts you on the ranked ladder.'}
            </p>
            <form class="form" novalidate>
              <div class="alert alert-error" data-form-error hidden></div>
              <label class="field">
                <span>Username</span>
                <input
                  name="username"
                  autocomplete="username"
                  required
                  minlength="${username.min}"
                  maxlength="${username.max}"
                  pattern="[A-Za-z0-9_]+"
                  autofocus
                />
                ${isLogin ? '' : html`<small>${username.min}-${username.max} characters: letters, numbers, underscores.</small>`}
              </label>
              ${isLogin
                ? ''
                : html`<label class="field">
                      <span>Display name <em>(optional)</em></span>
                      <input name="displayName" maxlength="${displayName.max}" placeholder="How others see you" />
                    </label>
                    <div class="field">
                      <span>Avatar</span>
                      ${avatarPicker('avatar', AVATARS[0])}
                    </div>`}
              <label class="field">
                <span>Password</span>
                <input
                  name="password"
                  type="password"
                  autocomplete="${isLogin ? 'current-password' : 'new-password'}"
                  required
                  minlength="${password.min}"
                  maxlength="${password.max}"
                />
                ${isLogin ? '' : html`<small>At least ${password.min} characters.</small>`}
              </label>
              ${isLogin
                ? ''
                : html`<label class="field">
                    <span>Confirm password</span>
                    <input name="confirm" type="password" autocomplete="new-password" required />
                  </label>`}
              <button class="btn btn-primary btn-block" type="submit">${isLogin ? 'Sign in' : 'Create account'}</button>
            </form>
            <p class="auth-switch">
              ${isLogin
                ? html`New to Arena Kingdom? <a href="/register${nextQuery}">Create an account</a>`
                : html`Already have an account? <a href="/login${nextQuery}">Sign in</a>`}
            </p>
            <p class="auth-switch muted"><a href="/play">Or play against the AI as a guest →</a></p>
          </div>
        </section>`
      );

      const form = $<HTMLFormElement>(root, 'form');
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const values = {
          username: String(data.get('username') ?? '').trim(),
          password: String(data.get('password') ?? ''),
          displayName: String(data.get('displayName') ?? '').trim(),
          avatar: String(data.get('avatar') ?? ''),
          confirm: String(data.get('confirm') ?? '')
        };
        if (!values.username || !values.password) return formError(form, 'Enter your username and password.');
        if (!isLogin) {
          if (!username.pattern.test(values.username) || values.username.length < username.min) {
            return formError(form, `Username must be ${username.min}-${username.max} letters, numbers or underscores.`);
          }
          if (values.password.length < password.min) return formError(form, `Password must be at least ${password.min} characters.`);
          if (values.password !== values.confirm) return formError(form, 'Passwords do not match.');
        }
        formError(form, null);
        void withBusy(form.querySelector('button[type="submit"]'), async () => {
          try {
            const auth = isLogin
              ? await api.login({ username: values.username, password: values.password })
              : await api.register({
                  username: values.username,
                  password: values.password,
                  displayName: values.displayName || undefined,
                  avatar: values.avatar || undefined
                });
            session.signIn(auth);
            toast(isLogin ? `Welcome back, ${auth.user.displayName}!` : `Long live ${auth.user.displayName}!`, 'success');
            navigate(next, { replace: true });
          } catch (error) {
            formError(form, (error as Error).message);
          }
        });
      });
    }
  };
}
