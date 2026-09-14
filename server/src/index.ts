import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import express from 'express';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GAME_VERSION } from '@arena-kingdom/shared';
import { config } from './config.js';
import { purgeExpiredSessions } from './db/sessions.js';
import { createApiRouter } from './http/api.js';
import { errorHandler } from './http/middleware.js';
import { ArenaRoom } from './rooms/ArenaRoom.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '32kb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, game: 'arena-kingdom', version: GAME_VERSION });
});
app.use('/api', createApiRouter());

// Serve the built client (npm run build) so production needs a single port.
if (existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    // Unknown asset paths (with an extension) should 404 rather than receive the app shell.
    if (req.method !== 'GET' || path.extname(req.path) || !req.accepts('html')) return next();
    res.sendFile(path.join(config.clientDist, 'index.html'));
  });
}

app.use(errorHandler);

const httpServer = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
  greet: false
});
gameServer.define('arena', ArenaRoom);

purgeExpiredSessions();
setInterval(purgeExpiredSessions, 60 * 60_000).unref();

httpServer.listen(config.port, () => {
  console.log(`Arena Kingdom server v${GAME_VERSION} listening on http://localhost:${config.port}`);
  console.log(`Database: ${config.databasePath}`);
  if (existsSync(config.clientDist)) console.log(`Serving client from ${config.clientDist}`);
});
