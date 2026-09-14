/**
 * Headless bot-vs-bot matches, useful for balancing and catching engine regressions.
 * Usage: npm --workspace shared run simulate -- [blueDifficulty] [redDifficulty] [matches]
 */
import { BotController, DIFFICULTIES, GAME_RULES, MatchEngine, type Difficulty, type Side } from '../src/index.js';

const [blueArg = 'normal', redArg = 'normal', countArg = '10'] = process.argv.slice(2);
const isDifficulty = (v: string): v is Difficulty => (DIFFICULTIES as readonly string[]).includes(v);
if (!isDifficulty(blueArg) || !isDifficulty(redArg)) {
  console.error(`Difficulty must be one of: ${DIFFICULTIES.join(', ')}`);
  process.exit(1);
}

const tally: Record<Side | 'draw', number> = { blue: 0, red: 0, draw: 0 };
const reasons: Record<string, number> = {};
let totalMs = 0;
const started = Date.now();

for (let i = 0; i < Number(countArg); i++) {
  const engine = new MatchEngine();
  const bots = [new BotController('blue', blueArg), new BotController('red', redArg)];
  while (!engine.ended) {
    for (const bot of bots) bot.update(engine, GAME_RULES.tickMs);
    engine.update(GAME_RULES.tickMs);
    engine.drainEvents();
  }
  const result = engine.state.result!;
  tally[result.winner ?? 'draw'] += 1;
  reasons[result.reason] = (reasons[result.reason] ?? 0) + 1;
  totalMs += result.timeMs;
  const { blue, red } = engine.state.players;
  console.log(
    `#${i + 1} winner=${result.winner ?? 'draw'} reason=${result.reason} time=${(result.timeMs / 60000).toFixed(1)}m ` +
      `blue[trained=${blue.stats.unitsTrained} kills=${blue.stats.kills} built=${blue.stats.buildingsBuilt}] ` +
      `red[trained=${red.stats.unitsTrained} kills=${red.stats.kills} built=${red.stats.buildingsBuilt}]`
  );
}

console.log(`\nblue(${blueArg}) ${tally.blue} - red(${redArg}) ${tally.red} - draws ${tally.draw}`);
console.log('reasons', reasons, `avg length ${(totalMs / Number(countArg) / 60000).toFixed(1)}m`);
console.log(`simulated in ${((Date.now() - started) / 1000).toFixed(1)}s`);
