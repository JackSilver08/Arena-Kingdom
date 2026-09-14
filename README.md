# 🏰 Arena Kingdom

Arena Kingdom is a lightweight, web-first 2D real-time strategy game built around 1v1 kingdom warfare.

## Vision

**Lightweight visuals, deep decisions.**

Players manage economy, build structures, recruit armies and command troops to destroy the enemy main castle.

## Current prototype

- 2D battlefield rendered with Phaser
- TypeScript + Vite client
- Build mode: `B`
- Troop command mode: `T`
- Messenger menu: `M`
- Gold economy and passive villages
- Barracks recruitment
- Three army groups: All / 1/3 / 2/3
- Local prototype combat and movement
- Server scaffold prepared for Colyseus multiplayer

## Planned stack

- TypeScript
- Phaser
- Vite
- Node.js
- Colyseus
- PostgreSQL
- A* pathfinding

## Run locally

```bash
npm install
npm run dev
```

The client runs on Vite's default development port. The server runs separately for the multiplayer scaffold.

## Repository status

This repository starts as the **Arena Kingdom v0.1 prototype**. Multiplayer authority, matchmaking, persistence and production assets are intentionally staged for later phases.
