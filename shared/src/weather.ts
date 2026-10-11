/**
 * Cosmetic weather for Arena Kingdom. Simulation rules remain identical in all
 * weather; these neutral multipliers prevent presentation from implying rules
 * that the authoritative engine does not implement.
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
    description: 'Clear skies · cosmetic weather',
    icon: '☀️'
  },
  rain: {
    moveSpeedMultiplier: 1,
    rangedRangeMultiplier: 1,
    buildDurationMultiplier: 1,
    visionMultiplier: 1,
    windAngle: Math.PI * 0.35,
    windStrength: 1.6,
    label: 'Driving Rainstorm',
    description: 'Rain and wet terrain · cosmetic weather',
    icon: '🌧️'
  },
  fog: {
    moveSpeedMultiplier: 1,
    rangedRangeMultiplier: 1,
    buildDurationMultiplier: 1,
    visionMultiplier: 1,
    windAngle: Math.PI * 0.05,
    windStrength: 0.4,
    label: 'Heavy Rolling Fog',
    description: 'Low mist · no change to unit vision',
    icon: '🌫️'
  },
  gale: {
    moveSpeedMultiplier: 1.0,
    rangedRangeMultiplier: 1,
    buildDurationMultiplier: 1,
    visionMultiplier: 1,
    windAngle: Math.PI * 0.6,
    windStrength: 2.2,
    label: 'Gale Force Winds',
    description: 'Wind in the trees · cosmetic weather',
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
