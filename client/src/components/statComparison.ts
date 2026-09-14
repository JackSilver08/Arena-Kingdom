import type { PlayerStats } from '@arena-kingdom/shared';
import { formatNumber } from '../lib/format';
import { html } from '../lib/html';

export const STAT_ROWS: { key: keyof PlayerStats; label: string }[] = [
  { key: 'goldEarned', label: '💰 Gold earned' },
  { key: 'goldSpent', label: '🪙 Gold spent' },
  { key: 'unitsTrained', label: '⚔️ Soldiers trained' },
  { key: 'peakArmy', label: '🛡️ Largest army' },
  { key: 'kills', label: '🗡️ Enemies slain' },
  { key: 'unitsLost', label: '💀 Soldiers lost' },
  { key: 'buildingsBuilt', label: '🏗️ Buildings raised' },
  { key: 'buildingsDestroyed', label: '🔥 Buildings razed' },
  { key: 'damageDealt', label: '💥 Damage dealt' }
];

export function statComparison(blue: PlayerStats, red: PlayerStats, labels: { blue: string; red: string }) {
  return html`<table class="compare">
    <thead><tr><th class="compare-blue">${labels.blue}</th><th></th><th class="compare-red">${labels.red}</th></tr></thead>
    <tbody>
      ${STAT_ROWS.map(({ key, label }) => {
        const a = blue[key];
        const b = red[key];
        const total = a + b || 1;
        return html`<tr>
          <td class="compare-value ${a > b ? 'lead' : ''}">${formatNumber(a)}</td>
          <td class="compare-label">
            <span>${label}</span>
            <span class="compare-bar"><i class="bar-blue" style="width:${((a / total) * 100).toFixed(1)}%"></i><i class="bar-red"></i></span>
          </td>
          <td class="compare-value ${b > a ? 'lead' : ''}">${formatNumber(b)}</td>
        </tr>`;
      })}
    </tbody>
  </table>`;
}
