import type {
  AiMatchReport,
  AuthResponse,
  CurrentUser,
  LeaderboardEntry,
  MatchListResponse,
  MatchMode,
  MatchSummary,
  OverviewStats,
  ProfileResponse
} from '@arena-kingdom/shared';
import { session } from './session';

/** Empty in development (Vite proxies /api); set VITE_SERVER_URL when the client is hosted elsewhere. */
export const SERVER_URL: string = import.meta.env.VITE_SERVER_URL ?? '';

const UNREACHABLE = 'Cannot reach the Arena Kingdom server. Make sure it is running.';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = session.token;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  let response: Response;
  try {
    response = await fetch(`${SERVER_URL}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ApiError(0, UNREACHABLE);
  }
  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    if (response.status === 401 && token && token === session.token) session.clear();
    // The dev proxy answers with a non-JSON 5xx when the game server is down.
    const fallback = response.status >= 500 && !data ? UNREACHABLE : `Request failed (${response.status}).`;
    throw new ApiError(response.status, data?.error ?? fallback);
  }
  if (data === null) throw new ApiError(response.status, 'The server returned an invalid response.');
  return data as T;
}

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : '';
};

export const api = {
  register: (body: { username: string; password: string; displayName?: string; avatar?: string }) =>
    request<AuthResponse>('POST', '/auth/register', body),
  login: (body: { username: string; password: string }) => request<AuthResponse>('POST', '/auth/login', body),
  logout: () => request<void>('POST', '/auth/logout'),
  me: () => request<{ user: CurrentUser }>('GET', '/auth/me'),
  updateProfile: (body: { displayName?: string; avatar?: string }) => request<{ user: CurrentUser }>('PATCH', '/me', body),
  changePassword: (body: { currentPassword: string; newPassword: string }) => request<{ ok: true }>('POST', '/me/password', body),
  myProfile: () => request<ProfileResponse>('GET', '/me/profile'),
  myMatches: (params: { mode?: MatchMode; limit?: number; offset?: number } = {}) =>
    request<MatchListResponse>('GET', `/me/matches${query(params)}`),
  profile: (username: string) => request<ProfileResponse>('GET', `/users/${encodeURIComponent(username)}`),
  userMatches: (username: string, params: { mode?: MatchMode; limit?: number; offset?: number } = {}) =>
    request<MatchListResponse>('GET', `/users/${encodeURIComponent(username)}/matches${query(params)}`),
  recentMatches: (params: { mode?: MatchMode; limit?: number } = {}) => request<MatchListResponse>('GET', `/matches${query(params)}`),
  match: (id: string) => request<MatchSummary>('GET', `/matches/${encodeURIComponent(id)}`),
  leaderboard: (limit = 50) => request<{ entries: LeaderboardEntry[] }>('GET', `/leaderboard${query({ limit })}`),
  overview: () => request<OverviewStats>('GET', '/overview'),
  reportAiMatch: (report: AiMatchReport) => request<{ id: string }>('POST', '/matches/ai', report)
};

/** Restores the signed-in user from a stored token. */
export async function restoreSession() {
  if (!session.token) return;
  try {
    const { user } = await api.me();
    session.setUser(user);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) session.clear();
  }
}
