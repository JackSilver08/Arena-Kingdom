import type { AuthResponse, CurrentUser } from '@arena-kingdom/shared';

const TOKEN_KEY = 'ak.token';

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode); the session then lasts for this tab only.
  }
}

type Listener = (user: CurrentUser | null) => void;

class SessionStore {
  token: string | null = read(TOKEN_KEY);
  user: CurrentUser | null = null;
  private listeners = new Set<Listener>();

  get signedIn() {
    return this.user !== null;
  }

  signIn(auth: AuthResponse) {
    this.token = auth.token;
    write(TOKEN_KEY, auth.token);
    this.setUser(auth.user);
  }

  setUser(user: CurrentUser | null) {
    this.user = user;
    for (const listener of this.listeners) listener(user);
  }

  clear() {
    this.token = null;
    write(TOKEN_KEY, null);
    this.setUser(null);
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const session = new SessionStore();
