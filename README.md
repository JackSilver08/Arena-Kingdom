# 🏰 Arena Kingdom

Arena Kingdom is a lightweight, web-first 2D real-time strategy game built around 1v1 kingdom warfare.

## Vision

**Lightweight visuals, deep decisions.**

Players manage economy, build structures, recruit armies and command troops to destroy the enemy main castle.

## What's in v0.2

**Game**

- Playable 1v1 RTS on a shared, framework-free engine (`shared/`): gold economy, villages, barracks training queues, towers, castle defences, soldier-vs-soldier combat and win conditions (castle, surrender, peace treaty, time limit)
- Computer opponents with three difficulties — Squire, Knight and Warlord
- Online 1v1 with a server-authoritative simulation (Colyseus): ranked matchmaking, private rooms with a code, reconnection after a dropped connection or page reload
- RTS controls: drag-select, right-click attack-move, Shift+right-click retreat, build mode `B`, recruit `R`, army orders `T` (All / ⅓ / ⅔), messenger `M`

**Website**

- Home page with live stats, top commanders and recent battles
- Accounts: register, sign in, profile with avatar and display name, password change
- Match history with filters and a detailed battle report for every match
- Elo leaderboard and public player profiles
- How-to-play guide generated from the actual game rules

## Stack

- TypeScript everywhere, npm workspaces (`client`, `server`, `shared`)
- Client: Vite, Phaser 3 (battle renderer), a small dependency-free SPA router
- Server: Node.js, Express 5 (REST API), Colyseus 0.16 (real-time rooms)
- Database: SQLite through Node's built-in `node:sqlite` — no database server to install

## Run locally

Requires **Node.js 22.13+** (24 recommended).

```bash
npm install
npm run dev
```

Open http://localhost:5173. See [RUNNING.md](RUNNING.md) for details, production builds and troubleshooting.

| Command            | What it does                                             |
| ------------------ | -------------------------------------------------------- |
| `npm run dev`      | Shared engine watcher + client (5173) + server (2567)    |
| `npm run build`    | Production build of all workspaces                       |
| `npm start`        | Serve the built client, API and game rooms on one port   |
| `npm test`         | Engine and AI tests                                      |
| `npm run simulate` | Headless bot-vs-bot matches, e.g. `-- hard normal 20`    |

## Project layout

```
shared/   Game rules, simulation engine, AI, network format, API types
server/   Express API, SQLite repositories, Colyseus ArenaRoom
client/   SPA pages, Phaser battle scene, HUD and input controller
docs/     Gameplay reference
```

## Gameplay

See [docs/GAMEPLAY.md](docs/GAMEPLAY.md).
