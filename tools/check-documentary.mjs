import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const required = [
  'client/src/game/displaySettings.ts',
  'client/src/game/displaySettingsPanel.ts',
  'client/src/game/visuals.ts',
  'client/src/game/frontlineOverlay.ts',
  'client/src/game/commandArrows.ts',
  'client/src/game/battleRecap.ts',
  'client/src/game/battleRecap.css',
  'docs/BATTLE_DOCUMENTARY_PHASE1.md',
  'docs/BATTLE_DOCUMENTARY_PHASE4.md',
  'docs/BATTLE_DOCUMENTARY_PHASE5.md'
];

const checks = [
  ['documentary map style', "mapStyle: 'documentary'", 'client/src/game/displaySettings.ts'],
  ['vintage map style', "'vintage'", 'client/src/game/mapArt.ts'],
  ['frontline depth below entities', 'frontline:', 'client/src/game/visuals.ts'],
  ['command arrow depth below entities', 'arrows:', 'client/src/game/visuals.ts'],
  ['replay integration', 'setReplayView', 'client/src/game/BattleScene.ts'],
  ['recap recorder', 'record(view: MatchView, events:', 'client/src/game/battleRecap.ts'],
  ['reduced motion class', 'reduced-motion', 'client/src/game/displaySettingsPanel.ts'],
  ['40px influence grid', 'INFLUENCE_CELL_SIZE = 40', 'shared/src/influence.ts'],
  ['documented QA workflow', 'npm run check:bundle', '.github/workflows/qa.yml']
];

const failures = [];
for (const path of required) {
  if (!existsSync(join(root, path))) failures.push(`missing ${path}`);
}
for (const [name, needle, path] of checks) {
  const file = join(root, path);
  if (!existsSync(file) || !readFileSync(file, 'utf8').includes(needle)) failures.push(`${name}: ${path}`);
}

// Regression guard for a previously observed drag-selection typo.
const battleScene = readFileSync(join(root, 'client/src/game/BattleScene.ts'), 'utf8');
if (battleScene.includes('Math.min(start.y, x) && Math.min(start.y, y)')) {
  failures.push('drag-selection top coordinate regression');
}

if (failures.length) {
  console.error('[documentary] FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`[documentary] PASS: ${required.length} required files and ${checks.length + 1} regression checks`);
