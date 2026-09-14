import express from 'express';
import { Server } from 'colyseus';
import { createServer } from 'http';
import { ArenaRoom } from './rooms/ArenaRoom.js';

const app = express();
app.get('/health', (_req, res) => {
  res.json({ ok: true, game: 'arena-kingdom', version: '0.1.0' });
});

const httpServer = createServer(app);
const gameServer = new Server({
  server: httpServer
});

gameServer.define('arena', ArenaRoom);

const port = Number(process.env.PORT ?? 2567);
httpServer.listen(port, () => {
  console.log(`Arena Kingdom server listening on http://localhost:${port}`);
});
