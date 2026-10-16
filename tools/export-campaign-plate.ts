import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GAME_RULES } from '@arena-kingdom/shared';
import { arenaMapArtAtlas } from '../client/src/game/atlasMapArt.ts';

const out = resolve(process.cwd(), 'artifacts', 'medieval-campaign-map.svg');
mkdirSync(resolve(process.cwd(), 'artifacts'), { recursive: true });
// This is the exact map texture source loaded by Phaser; entities are separate.
writeFileSync(out, arenaMapArtAtlas(GAME_RULES.map, 'high', true), 'utf8');
console.log('[atlas preview] Wrote', out);
