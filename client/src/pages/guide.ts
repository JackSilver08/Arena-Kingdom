import { BUILDABLE_TYPES, BUILDING_STATS, GAME_RULES, UNIT_STATS } from '@arena-kingdom/shared';
import { html, setHtml } from '../lib/html';
import type { Page } from '../lib/router';

const CONTROLS: [string, string][] = [
  ['Left-drag', 'Select soldiers inside the box (hold Shift to add)'],
  ['Left-click soldier', 'Select one soldier (Shift toggles)'],
  ['Right-click', 'Selected soldiers attack-move: they fight anything on the way'],
  ['Shift + Right-click', 'Move without stopping to fight — use it to retreat'],
  ['A', 'Select your whole army'],
  ['S', 'Selected soldiers hold position'],
  ['B', 'Build mode — then 1 Village · 2 Barracks · 3 Tower, click to place (Shift keeps building)'],
  ['R', 'Recruit a soldier at the least busy barracks (Shift + R queues 5)'],
  ['Click your Barracks', 'Recruit a soldier at that barracks'],
  ['T', 'Troop command — then 1 All · 2 ⅓ · 3 ⅔, click a destination'],
  ['M', 'Messenger: propose peace or surrender'],
  ['Esc', 'Cancel the current order or clear the selection']
];

export function guidePage(): Page {
  const { economy, limits, maxMatchMs, peace } = GAME_RULES;
  const soldier = UNIT_STATS.soldier;
  const castle = BUILDING_STATS.castle;
  return {
    title: 'How to play',
    mount(root) {
      setHtml(
        root,
        html`<section class="wrap page guide">
          <div class="page-head">
            <div>
              <h1>How to play</h1>
              <p class="muted">Everything you need to rule the island — in five minutes.</p>
            </div>
            <a class="btn btn-primary" href="/play">Start a battle</a>
          </div>

          <div class="panel">
            <h2>🎯 Goal</h2>
            <p>
              Destroy the enemy <strong>Castle</strong> (${castle.hp} HP). You control the <strong>Blue kingdom</strong> on the left
              (in online matches you may be Red on the right). Castles fire arrows at attackers, so bring enough soldiers.
            </p>
            <p class="muted">
              Matches can also end by surrender, by a peace treaty both rulers accept, or after ${maxMatchMs / 60000} minutes —
              then the castle with more health wins.
            </p>
          </div>

          <div class="grid-2">
            <div class="panel">
              <h2>💰 Economy</h2>
              <ul class="checklist">
                <li>Start with <strong>${economy.startingGold} gold</strong>, 2 villages, a barracks and 4 soldiers.</li>
                <li>Every <strong>${economy.incomeIntervalMs / 1000}s</strong> your castle pays +${economy.castleIncome} and each village +${economy.villageIncome}.</li>
                <li>Losing villages cuts your income — protect them or hit your enemy's.</li>
              </ul>
            </div>
            <div class="panel">
              <h2>⚔️ Soldiers</h2>
              <ul class="checklist">
                <li>Cost <strong>${soldier.cost} gold</strong>, trained in ${soldier.trainMs / 1000}s at a barracks (queue up to ${economy.maxQueuePerBarracks}).</li>
                <li>${soldier.hp} HP, ${soldier.attack.damage} damage every ${soldier.attack.cooldownMs / 1000}s.</li>
                <li>They automatically fight enemies that come within range. Army limit: ${limits.maxUnitsPerSide}.</li>
              </ul>
            </div>
          </div>

          <div class="panel">
            <h2>🏗️ Buildings</h2>
            <div class="table-scroll">
              <table class="table">
                <thead><tr><th></th><th>Building</th><th>Cost</th><th>HP</th><th>What it does</th></tr></thead>
                <tbody>
                  ${BUILDABLE_TYPES.map((type) => {
                    const stats = BUILDING_STATS[type];
                    return html`<tr>
                      <td class="table-icon">${stats.icon}</td>
                      <td><strong>${stats.label}</strong></td>
                      <td>${stats.cost}g</td>
                      <td>${stats.hp}</td>
                      <td>${stats.description}</td>
                    </tr>`;
                  })}
                </tbody>
              </table>
            </div>
            <p class="muted">Buildings must be placed inside your own territory, outside the contested center strip.</p>
          </div>

          <div class="panel">
            <h2>🖱️ Controls</h2>
            <div class="table-scroll">
              <table class="table controls-table">
                <tbody>
                  ${CONTROLS.map(([key, action]) => html`<tr><td><kbd>${key}</kbd></td><td>${action}</td></tr>`)}
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel">
            <h2>✉️ Diplomacy</h2>
            <p>
              Open the Messenger with <kbd>M</kbd>. A peace proposal gives your opponent ${peace.responseWindowMs / 1000}s to answer; if
              they accept, the battle ends in a draw. You can send a new proposal every ${peace.cooldownMs / 1000}s. AI commanders accept
              peace only when they are losing.
            </p>
          </div>

          <div class="panel">
            <h2>💡 Strategy tips</h2>
            <ul class="checklist">
              <li>An early third village pays for itself in ${Math.round(BUILDING_STATS.village.cost / economy.villageIncome) * (economy.incomeIntervalMs / 1000)}s — but only if you survive the first attack.</li>
              <li>A second barracks doubles how fast you can turn gold into soldiers.</li>
              <li>Towers are cheap insurance near your castle. Attack them with a big group, not one by one.</li>
              <li>Pull a losing fight back with Shift + Right-click and regroup under your castle's arrows.</li>
            </ul>
          </div>
        </section>`
      );
    }
  };
}
