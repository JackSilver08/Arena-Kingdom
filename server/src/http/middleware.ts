import type { NextFunction, Request, Response } from 'express';
import type { CurrentUser } from '@arena-kingdom/shared';
import { userForToken } from '../db/sessions.js';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export function bearerToken(req: Request) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

export interface AuthLocals {
  user: CurrentUser;
  userRow: NonNullable<ReturnType<typeof userForToken>>['row'];
  token: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = bearerToken(req);
  const session = userForToken(token);
  if (!token || !session) {
    next(new HttpError(401, 'Please sign in to continue.'));
    return;
  }
  Object.assign(res.locals, { user: session.user, userRow: session.row, token } satisfies AuthLocals);
  next();
}

export function auth(res: Response) {
  return res.locals as AuthLocals;
}

/** Fixed-window, in-memory rate limiter keyed by client IP. */
export function rateLimit(options: { windowMs: number; max: number; message: string }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  setInterval(() => {
    const t = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= t) hits.delete(key);
  }, options.windowMs).unref();
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const t = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      hits.set(key, { count: 1, resetAt: t + options.windowMs });
      next();
      return;
    }
    entry.count += 1;
    next(entry.count > options.max ? new HttpError(429, options.message) : undefined);
  };
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  const status = (error as { status?: number; type?: string }).status;
  if (status === 400 || status === 413) {
    res.status(status).json({ error: status === 413 ? 'Request is too large.' : 'Malformed request body.' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Something went wrong on our side.' });
}
