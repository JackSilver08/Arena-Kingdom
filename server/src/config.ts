import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load server/.env when present (Node >= 21.7).
if (existsSync('.env')) process.loadEnvFile('.env');

const here = path.dirname(fileURLToPath(import.meta.url));
/** Repository root; `here` is server/src in development and server/dist in production. */
const root = path.resolve(here, '../..');

export const config = {
  port: Number(process.env.PORT ?? 2567),
  databasePath: path.resolve(root, process.env.DATABASE_PATH ?? 'database/arena.db'),
  clientDist: path.resolve(root, 'client/dist'),
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 30),
  reconnectSeconds: Number(process.env.RECONNECT_SECONDS ?? 30),
  isProduction: process.env.NODE_ENV === 'production'
};
