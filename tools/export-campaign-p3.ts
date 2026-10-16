import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { campaignKeySvg } from '../client/src/game/campaignPresentation.ts';

const directory=resolve(process.cwd(), 'artifacts');
mkdirSync(directory,{recursive:true});
const path=resolve(directory,'medieval-campaign-commands.svg');
writeFileSync(path,campaignKeySvg(),'utf8');
console.log('[P3 art proof] Wrote',path);
