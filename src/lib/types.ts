// Client-safe shapes mirroring API responses (no server imports).

export type GlobalRole = "ADMIN" | "USER";
export type TournamentRole = "TOURNAMENT_ADMIN" | "PLAYER";
export type HandicapClass = "SCRATCH" | "A" | "B" | "C" | "D";
export type RoundType = "SCRAMBLE" | "PLAYOFF";

export interface Me {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: GlobalRole;
}

export interface PlayerLite {
  id: string;
  displayName: string;
  handicap: number;
  handicapClass: string;
  userId: string | null;
  role: string;
}

export interface HoleInfo {
  number: number;
  par: number;
  strokeIndex: number;
}

export interface HoleResult {
  holeNumber: number;
  strokeIndex: number;
  par: number;
  complete: boolean;
  teams: { teamId: string; gross: number; strokesReceived: number; net: number; won: boolean }[];
  winningTeamIds: string[];
  bestNet: number | null;
}

export interface RoundComputation {
  roundId: string;
  roundNumber: number;
  name: string;
  type: RoundType;
  status: string;
  holes: HoleInfo[];
  pointsByPlayer: Record<string, number>;
  holeResults?: HoleResult[];
  teamHandicaps?: Record<string, number>;
  achievements: {
    type: "LONGEST_DRIVE" | "CLOSEST_TO_PIN";
    holeNumber: number;
    holderPlayerId: string | null;
    distance: number | null;
    unit: string | null;
  }[];
}

export interface StandingRow {
  playerId: string;
  points: number;
  rank: number;
  seed: number;
}

export interface PlayoffResult {
  pairs: {
    bracketRank: number;
    positions: [number, number];
    results: {
      playerId: string;
      grossTotal: number;
      strokesReceived: number;
      netTotal: number;
      finalPosition: number;
      won: boolean;
    }[];
  }[];
  finalPositions: { playerId: string; finalPosition: number }[];
}

export interface TournamentState {
  tournamentId: string;
  name: string;
  status: string;
  handicapMode: string;
  pointsPerHole: number;
  rounds: RoundComputation[];
  totalPoints: Record<string, number>;
  standings: StandingRow[];
  playoff: PlayoffResult | null;
  finalPositions: { playerId: string; finalPosition: number }[] | null;
  players: PlayerLite[];
}

export interface TeamWithMembers {
  id: string;
  name: string | null;
  bracketRank: number | null;
  roundId: string;
  members: { id: string; playerId: string; player: PlayerLite }[];
}

export interface Course {
  id: string;
  name: string;
  holes: HoleInfo[];
}

export interface ChatMessageDto {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; displayName: string; username: string };
  mentions: { player: { id: string; displayName: string } }[];
}

export const CLASS_LABELS: Record<HandicapClass, string> = {
  SCRATCH: "Scratch (0)",
  A: "A (5)",
  B: "B (10)",
  C: "C (15)",
  D: "D (20)",
};
