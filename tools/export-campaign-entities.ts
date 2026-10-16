import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { atlasEntityArt, ATLAS_ENTITY_VERSION } from '../client/src/game/atlasEntityArt.ts';
import { ATLAS_COLORS as C } from '../client/src/game/atlasStyle.ts';

// A visual review sheet composed from the very same SVG renderer as the game.
// No replacement mockups and no independently painted static icons.
const OUT=resolve(process.cwd(), 'artifacts', 'medieval-campaign-entities.svg');
const buildings=['castle','village','barracks','tower','fence'] as const;
const units=['soldier','militia','archer','knight','scout','royal_guard','cannon'] as const;
type Kind=(typeof buildings)[number]|(typeof units)[number];
type Team='blue'|'red';

const esc=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const image=(type:Kind,side:Team,x:number,y:number,w:number,h:number)=>{
  const markup=atlasEntityArt(type,side);
  return markup.replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${h}" `);
};
const block=(x:number,y:number,w:number,h:number)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${C.paperLight}" stroke="#a99579" stroke-width="1.2"/>`;
const heading=(x:number,y:number,label:string,size=18)=>`<text x="${x}" y="${y}" fill="${C.ink}" text-anchor="middle" font-family="Georgia,serif" font-size="${size}" letter-spacing="1.4">${esc(label)}</text>`;
const buildingCards=buildings.map((type,i)=>{
  const x=39+i*304;
  return block(x,148,288,325)
    +heading(x+144,176,type.toUpperCase(),17)
    +image(type,'blue',x+19,189,125,127)
    +image(type,'red',x+151,189,125,127)
    +heading(x+82,335,'BLUE',12)+heading(x+217,335,'RED',12)
    +`<path d="M${x+20} 352h248" stroke="#c5aa81" stroke-width="1"/>`
    +heading(x+144,393,'Hand-inked landmark',14);
}).join('');
const counterCards=units.map((type,i)=>{
  const x=34+i*220;
  return block(x,549,207,303)
    +heading(x+103,582,type.replace(/_/g,' ').toUpperCase(),14)
    +image(type,'blue',x+31,611,145,98)
    +image(type,'red',x+31,711,145,98);
}).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="920" viewBox="0 0 1600 920"
  data-proof="rendered-entity-assets" data-entity-version="${ATLAS_ENTITY_VERSION}">
  <defs><pattern id="sheet-grain" width="40" height="42" patternUnits="userSpaceOnUse">
    <circle cx="8" cy="12" r="1" fill="#80684c" opacity=".18"/>
    <circle cx="35" cy="32" r=".8" fill="#80684c" opacity=".11"/>
  </pattern></defs>
  <rect width="1600" height="920" fill="${C.paper}"/>
  <rect width="1600" height="920" fill="url(#sheet-grain)"/>
  <rect x="16" y="16" width="1568" height="888" fill="none" stroke="${C.inkSoft}" stroke-width="4"/>
  ${heading(800,70,'ARENA KINGDOM  -  MEDIEVAL CAMPAIGN ENGRAVINGS',27)}
  ${heading(800,112,'P2  -  FIVE BUILDINGS AND SEVEN TACTICAL COUNTERS',16)}
  ${buildingCards}
  ${heading(800,520,'THE SEVEN MILITARY COUNTERS',20)}
  ${counterCards}
  ${heading(800,882,'Artwork generated from the actual live SVG texture functions - not a hand-painted mockup',15)}
</svg>`;
mkdirSync(resolve(process.cwd(),'artifacts'),{recursive:true});
writeFileSync(OUT,svg,'utf8');
console.log('[atlas entities] Wrote',OUT,'bytes',svg.length);
