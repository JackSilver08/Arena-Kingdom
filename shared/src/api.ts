import type { Difficulty, EndReason, MatchMode, PlayerStats, Side } from './types.js';

export const AVATARS = ['🛡️', '⚔️', '🏰', '👑', '🐉', '🦁', '🦅', '🐺', '🔥', '❄️', '⚡', '🌙'] as const;

export const ACCOUNT_RULES = {
  username: { min: 3, max: 20, pattern: /^[A-Za-z0-9_]+$/ },
  displayName: { min: 1, max: 24 },
  password: { min: 8, max: 128 }
} as const;

export interface PublicUser {
  id: number;
  username: string;
  displayName: string;
  avatar: string;
  rating: number;
  createdAt: string;
}

export interface CurrentUser extends PublicUser {
  lastLoginAt: string | null;
}

export interface AuthResponse {
  token: string;
  user: CurrentUser;
}

export interface ModeRecord {
  played: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface UserStatsSummary {
  pvp: ModeRecord;
  ai: ModeRecord & { byDifficulty: Record<Difficulty, ModeRecord> };
  totals: {
    unitsTrained: number;
    kills: number;
    buildingsBuilt: number;
    buildingsDestroyed: number;
    goldEarned: number;
    playTimeMs: number;
  };
  peakRating: number;
}

export interface ProfileResponse {
  user: PublicUser;
  stats: UserStatsSummary;
  rank: number | null;
}

export type MatchOutcome = 'win' | 'loss' | 'draw';

export interface MatchParticipant {
  side: Side;
  userId: number | null;
  username: string | null;
  displayName: string;
  avatar: string;
  isBot: boolean;
  outcome: MatchOutcome;
  ratingBefore: number | null;
  ratingAfter: number | null;
  stats: PlayerStats;
}

export interface MatchSummary {
  id: string;
  mode: MatchMode;
  /** Ranked online matches change ratings; private rooms are friendly. */
  rated: boolean;
  difficulty: Difficulty | null;
  endReason: EndReason;
  winnerSide: Side | null;
  durationMs: number;
  endedAt: string;
  players: MatchParticipant[];
}

export interface MatchListResponse {
  matches: MatchSummary[];
  total: number;
}

export interface LeaderboardEntry {
  rank: number;
  user: PublicUser;
  played: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface OverviewStats {
  players: number;
  matches: number;
  onlineRooms: number;
  onlinePlayers: number;
}

export interface AiMatchReport {
  difficulty: Difficulty;
  side: Side;
  winner: Side | null;
  reason: EndReason;
  durationMs: number;
  stats: Record<Side, PlayerStats>;
}

export interface ApiError {
  error: string;
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Squire',
  normal: 'Knight',
  hard: 'Warlord'
};

export const END_REASON_LABELS: Record<EndReason, string> = {
  castle: 'Castle destroyed',
  surrender: 'Surrender',
  peace: 'Peace treaty',
  timeout: 'Time limit',
  disconnect: 'Disconnected'
};
