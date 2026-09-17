import type { FormationType, Vec2 } from './types.js';

export interface FormationDefinition {
  label: string;
  shortLabel: string;
  description: string;
  attackMultiplier: number;
  defenseMultiplier: number;
  speedMultiplier: number;
  spacing: number;
}

export const FORMATION_TYPES: readonly FormationType[] = ['line', 'column', 'wedge', 'square'];

export const FORMATION_STATS: Record<FormationType, FormationDefinition> = {
  line: {
    label: 'Line',
    shortLabel: 'Line',
    description: 'Broad front. Strong direct attack and steady defence, but slower to advance.',
    attackMultiplier: 1.1,
    defenseMultiplier: 1.05,
    speedMultiplier: 0.95,
    spacing: 22
  },
  column: {
    label: 'Column',
    shortLabel: 'Column',
    description: 'Deep marching order. Faster movement with a narrower fighting front.',
    attackMultiplier: 1,
    defenseMultiplier: 0.98,
    speedMultiplier: 1.12,
    spacing: 20
  },
  wedge: {
    label: 'V-Wedge',
    shortLabel: 'Wedge',
    description: 'Concentrated spearhead. Excellent for breaking a line, weaker while exposed.',
    attackMultiplier: 1.15,
    defenseMultiplier: 0.95,
    speedMultiplier: 1.05,
    spacing: 22
  },
  square: {
    label: 'Square',
    shortLabel: 'Square',
    description: 'Compact all-round formation. Harder to flank, but much slower and less aggressive.',
    attackMultiplier: 0.9,
    defenseMultiplier: 1.18,
    speedMultiplier: 0.85,
    spacing: 20
  }
};

export function formationOffsets(count: number, formation: FormationType = 'line', spacing = FORMATION_STATS[formation].spacing, facing = 0): Vec2[] {
  if (count <= 0) return [];

  const local: Vec2[] = [];
  if (formation === 'line') {
    const columns = count;
    for (let i = 0; i < count; i++) local.push({ x: i - (columns - 1) / 2, y: 0 });
  } else if (formation === 'column') {
    for (let i = 0; i < count; i++) local.push({ x: 0, y: i - (count - 1) / 2 });
  } else if (formation === 'square') {
    const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
    const rows = Math.ceil(count / columns);
    for (let i = 0; i < count; i++) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      local.push({ x: col - (columns - 1) / 2, y: row - (rows - 1) / 2 });
    }
  } else {
    // Front point plus expanding rear pairs creates a clear V silhouette.
    local.push({ x: 0, y: 1 });
    let index = 1;
    let row = 1;
    while (index < count) {
      const spread = row;
      local.push({ x: -spread, y: -row * 0.85 });
      index += 1;
      if (index < count) {
        local.push({ x: spread, y: -row * 0.85 });
        index += 1;
      }
      row += 1;
    }
  }

  const meanX = local.reduce((sum, p) => sum + p.x, 0) / local.length;
  const meanY = local.reduce((sum, p) => sum + p.y, 0) / local.length;
  const cos = Math.cos(facing);
  const sin = Math.sin(facing);
  return local.map((p) => {
    const lx = (p.x - meanX) * spacing;
    const ly = (p.y - meanY) * spacing;
    return {
      x: lx * cos - ly * sin,
      y: lx * sin + ly * cos
    };
  });
}

export function formationPercent(value: number) {
  const percent = Math.round(Math.abs(value - 1) * 100);
  return `${value >= 1 ? '+' : '-'}${percent}%`;
}
