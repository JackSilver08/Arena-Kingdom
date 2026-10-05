/**
 * Weather simulation system for Arena Kingdom:
 * Defines dynamic climate conditions and their tactical impacts on troop movement,
 * ranged combat, vision, and building construction.
 */

export type WeatherType = 'fair' | 'rain' | 'fog' | 'gale';

export interface WeatherModifiers {
  moveSpeedMultiplier: number;
  rangedRangeMultiplier: number;
  buildDurationMultiplier: number;
  visionMultiplier: number;
  windAngle: number;
  windStrength: number;
  label: string;
  description: string;
  icon: string;
}

export const WEATHER_CONFIGS: Record<WeatherType, WeatherModifiers> = {
  fair: {
    moveSpeedMultiplier: 1.0,
    rangedRangeMultiplier: 1.0,
    buildDurationMultiplier: 1.0,
    visionMultiplier: 1.0,
    windAngle: Math.PI * 0.15,
    windStrength: 0.8,
    label: 'Fair Daylight',
    description: 'Clear skies. Optimal march, vision, and building conditions.',
    icon: '☀️'
  },
  rain: {
    moveSpeedMultiplier: 0.8,
    rangedRangeMultiplier: 0.85,
    buildDurationMultiplier: 1.3,
    visionMultiplier: 0.9,
    windAngle: Math.PI * 0.35,
    windStrength: 1.6,
    label: 'Driving Rainstorm',
    description: 'Muddy terrain slows march (-20%). Construction delayed (+30%).',
    icon: '🌧️'
  },
  fog: {
    moveSpeedMultiplier: 0.95,
    rangedRangeMultiplier: 0.85,
    buildDurationMultiplier: 1.05,
    visionMultiplier: 0.65,
    windAngle: Math.PI * 0.05,
    windStrength: 0.4,
    label: 'Heavy Rolling Fog',
    description: 'Fog of War contracted (-35%). High ambush potential.',
    icon: '🌫️'
  },
  gale: {
    moveSpeedMultiplier: 1.0,
    rangedRangeMultiplier: 0.9,
    buildDurationMultiplier: 1.15,
    visionMultiplier: 0.95,
    windAngle: Math.PI * 0.6,
    windStrength: 2.2,
    label: 'Gale Force Winds',
    description: 'Strong gusts sway forests and affect projectile flight.',
    icon: '💨'
  }
};

/** Deterministic weather sequence based on match elapsed time. */
export function weatherAtTime(matchTimeMs: number): WeatherType {
  // Cycle every 60 seconds: fair -> rain -> fair -> fog -> gale -> fair ...
  const cycleMs = 60_000;
  const index = Math.floor(matchTimeMs / cycleMs) % 5;
  const sequence: WeatherType[] = ['fair', 'rain', 'fog', 'gale', 'fair'];
  return sequence[index] ?? 'fair';
}
