/**
 * Brooks Invitational scoring engine.
 *
 * Pure functions — no database or framework dependencies — so the unusual
 * rules of this tournament can be unit-tested in isolation.
 *
 * The rules (see README for the full description):
 *  - Handicap classes: SCRATCH=0, A=5, B=10, C=15, D=20 over an 18-hole course.
 *  - Holes carry a stroke index 1-18 (1 = hardest, 18 = easiest). A handicap of H
 *    gives a stroke on every hole whose index <= (H mod 18), plus floor(H/18)
 *    strokes on every hole.
 *  - Scramble teams take a single team handicap derived from the two partners
 *    (default MAX — the higher partner's handicap; the lower "cancels out").
 *  - Each scramble hole is won by the team(s) with the lowest NET score; every
 *    player on a winning team scores `pointsPerHole` (ties award all tied teams).
 *  - Per round, the Longest Drive and Closest To Pin holders each score 1 point.
 *  - After 7 scramble rounds, players are seeded by total points and paired
 *    1v2, 3v4, 5v6, 7v8 for a stroke-play playoff. The winner of a pair takes
 *    the higher of that pair's two positions — a seed can climb at most one slot.
 */

export type HandicapClass = "SCRATCH" | "A" | "B" | "C" | "D";
export type ScrambleHandicapMode = "MAX" | "DIFFERENCE" | "AVERAGE";
export type AchievementType = "LONGEST_DRIVE" | "CLOSEST_TO_PIN";

export const CLASS_HANDICAPS: Record<HandicapClass, number> = {
  SCRATCH: 0,
  A: 5,
  B: 10,
  C: 15,
  D: 20,
};

export function classToHandicap(cls: HandicapClass): number {
  return CLASS_HANDICAPS[cls];
}

export interface HoleInfo {
  number: number; // 1-18
  par: number;
  strokeIndex: number; // 1-18, 1 = hardest
}

/**
 * Strokes a given handicap receives on a single hole with the given stroke index.
 * Standard golf allocation, generalised so handicaps above 18 wrap correctly.
 */
export function strokesForHole(handicap: number, strokeIndex: number): number {
  if (handicap <= 0) return 0;
  const base = Math.floor(handicap / 18);
  const remainder = handicap % 18;
  return base + (strokeIndex <= remainder ? 1 : 0);
}

/** Total strokes a handicap receives across a specific set of holes. */
export function strokesForHoles(handicap: number, holes: HoleInfo[]): number {
  return holes.reduce((sum, h) => sum + strokesForHole(handicap, h.strokeIndex), 0);
}

/** Derive a 2-person scramble team's handicap from its two partners. */
export function teamHandicap(
  h1: number,
  h2: number,
  mode: ScrambleHandicapMode = "MAX",
): number {
  switch (mode) {
    case "DIFFERENCE":
      return Math.abs(h1 - h2);
    case "AVERAGE":
      return Math.round((h1 + h2) / 2);
    case "MAX":
    default:
      return Math.max(h1, h2);
  }
}

export function netForHole(
  gross: number,
  handicap: number,
  strokeIndex: number,
): number {
  return gross - strokesForHole(handicap, strokeIndex);
}

// ---------------------------------------------------------------------------
// Scramble round scoring
// ---------------------------------------------------------------------------

export interface ScrambleTeamInput {
  teamId: string;
  playerIds: string[]; // the 2 partners
  handicap: number; // already-derived team handicap
  /** Gross score keyed by hole number. Missing = not yet entered. */
  grossByHole: Record<number, number | undefined>;
}

export interface HoleResult {
  holeNumber: number;
  strokeIndex: number;
  par: number;
  complete: boolean; // every team has entered a gross score
  /** Per team: gross, strokes received, net. */
  teams: {
    teamId: string;
    gross: number;
    strokesReceived: number;
    net: number;
    won: boolean;
  }[];
  winningTeamIds: string[];
  bestNet: number | null;
}

export interface ScrambleRoundResult {
  holeResults: HoleResult[];
  /** Points earned per player from winning holes only (excludes LD/CTP). */
  holePointsByPlayer: Record<string, number>;
}

/**
 * Score a scramble round. Points are awarded live based on whichever teams have
 * entered a gross score for a hole; a hole is flagged `complete` once all teams
 * have entered. Tied-best teams all win the hole and each of their players earns
 * `pointsPerHole`.
 */
export function scoreScrambleRound(
  teams: ScrambleTeamInput[],
  holes: HoleInfo[],
  pointsPerHole = 1,
): ScrambleRoundResult {
  const holePointsByPlayer: Record<string, number> = {};
  const holeResults: HoleResult[] = [];

  for (const hole of holes) {
    const entered = teams.filter(
      (t) => typeof t.grossByHole[hole.number] === "number",
    );

    const teamRows = entered.map((t) => {
      const gross = t.grossByHole[hole.number] as number;
      const strokesReceived = strokesForHole(t.handicap, hole.strokeIndex);
      return {
        teamId: t.teamId,
        gross,
        strokesReceived,
        net: gross - strokesReceived,
        won: false,
      };
    });

    let bestNet: number | null = null;
    let winningTeamIds: string[] = [];

    if (teamRows.length > 0) {
      bestNet = Math.min(...teamRows.map((r) => r.net));
      for (const row of teamRows) {
        if (row.net === bestNet) {
          row.won = true;
          winningTeamIds.push(row.teamId);
        }
      }
      // Award points to every player on every winning team.
      for (const winId of winningTeamIds) {
        const team = teams.find((t) => t.teamId === winId)!;
        for (const pid of team.playerIds) {
          holePointsByPlayer[pid] = (holePointsByPlayer[pid] ?? 0) + pointsPerHole;
        }
      }
    }

    holeResults.push({
      holeNumber: hole.number,
      strokeIndex: hole.strokeIndex,
      par: hole.par,
      complete: entered.length === teams.length && teams.length > 0,
      teams: teamRows,
      winningTeamIds,
      bestNet,
    });
  }

  return { holeResults, holePointsByPlayer };
}

export interface AchievementHolder {
  type: AchievementType;
  playerId: string | null;
}

/** Combine hole points with the round's LD/CTP achievement points (1 each). */
export function scrambleRoundPlayerPoints(
  result: ScrambleRoundResult,
  achievements: AchievementHolder[],
): Record<string, number> {
  const points: Record<string, number> = { ...result.holePointsByPlayer };
  for (const a of achievements) {
    if (a.playerId) {
      points[a.playerId] = (points[a.playerId] ?? 0) + 1;
    }
  }
  return points;
}

// ---------------------------------------------------------------------------
// Tournament standings (after the 7 scramble rounds)
// ---------------------------------------------------------------------------

export interface StandingRow {
  playerId: string;
  points: number;
  rank: number; // 1 = leader; ties share a rank
  seed: number; // strict 1..N ordering used for playoff pairing
}

/**
 * Rank players by total points (descending). `rank` shares the position on ties;
 * `seed` is a strict ordering (ties broken by the provided tiebreak list, then id)
 * so the playoff bracket always has a definite pairing.
 */
export function computeStandings(
  pointsByPlayer: Record<string, number>,
  playerIds: string[],
  tiebreak: (a: string, b: string) => number = (a, b) => a.localeCompare(b),
): StandingRow[] {
  const sorted = [...playerIds].sort((a, b) => {
    const diff = (pointsByPlayer[b] ?? 0) - (pointsByPlayer[a] ?? 0);
    if (diff !== 0) return diff;
    return tiebreak(a, b);
  });

  let lastPoints: number | null = null;
  let lastRank = 0;
  return sorted.map((playerId, index) => {
    const points = pointsByPlayer[playerId] ?? 0;
    const seed = index + 1;
    const rank = points === lastPoints ? lastRank : seed;
    lastPoints = points;
    lastRank = rank;
    return { playerId, points, rank, seed };
  });
}

/** Sum per-round point maps into a single tournament point total per player. */
export function sumPoints(
  roundPointMaps: Record<string, number>[],
): Record<string, number> {
  const total: Record<string, number> = {};
  for (const map of roundPointMaps) {
    for (const [pid, pts] of Object.entries(map)) {
      total[pid] = (total[pid] ?? 0) + pts;
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Playoff
// ---------------------------------------------------------------------------

export interface PlayoffPair {
  bracketRank: number; // 1 => positions 1&2, 2 => 3&4, ...
  highSeedPlayerId: string; // the better-seeded of the pair
  lowSeedPlayerId: string | null; // null if an odd number of players leaves a bye
  positions: [number, number]; // the two final positions this pair decides
}

/** Build the playoff bracket from seeded standings: 1v2, 3v4, 5v6, ... */
export function buildPlayoffBracket(standings: StandingRow[]): PlayoffPair[] {
  const seeded = [...standings].sort((a, b) => a.seed - b.seed);
  const pairs: PlayoffPair[] = [];
  for (let i = 0; i < seeded.length; i += 2) {
    const high = seeded[i];
    const low = seeded[i + 1] ?? null;
    pairs.push({
      bracketRank: pairs.length + 1,
      highSeedPlayerId: high.playerId,
      lowSeedPlayerId: low ? low.playerId : null,
      positions: [i + 1, i + 2],
    });
  }
  return pairs;
}

export interface PlayoffPlayerInput {
  playerId: string;
  handicap: number;
  grossByHole: Record<number, number | undefined>;
}

export interface PlayoffPairResult {
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
}

export interface FinalPositionRow {
  playerId: string;
  finalPosition: number;
}

/**
 * Resolve the playoff. Each pair plays stroke play; net total = gross - handicap
 * strokes over the 9 holes. Lower net takes the higher position of the pair. A
 * tie (or an unfinished pair) keeps the original seeding. Returns both detailed
 * pair results and a flat final-position list.
 */
export function resolvePlayoff(
  bracket: PlayoffPair[],
  players: Record<string, PlayoffPlayerInput>,
  holes: HoleInfo[],
): { pairs: PlayoffPairResult[]; finalPositions: FinalPositionRow[] } {
  const pairs: PlayoffPairResult[] = [];
  const finalPositions: FinalPositionRow[] = [];

  for (const pair of bracket) {
    const [highPos, lowPos] = pair.positions;

    // Bye: a lone player keeps their position.
    if (!pair.lowSeedPlayerId) {
      finalPositions.push({ playerId: pair.highSeedPlayerId, finalPosition: highPos });
      pairs.push({
        bracketRank: pair.bracketRank,
        positions: pair.positions,
        results: [netRow(pair.highSeedPlayerId, players, holes, highPos, true)],
      });
      continue;
    }

    const highNet = netTotal(pair.highSeedPlayerId, players, holes);
    const lowNet = netTotal(pair.lowSeedPlayerId, players, holes);

    // Lower net wins; on a tie the higher seed keeps the better position.
    const lowSeedWins = lowNet.netTotal < highNet.netTotal;
    const highSeedFinal = lowSeedWins ? lowPos : highPos;
    const lowSeedFinal = lowSeedWins ? highPos : lowPos;

    finalPositions.push({ playerId: pair.highSeedPlayerId, finalPosition: highSeedFinal });
    finalPositions.push({ playerId: pair.lowSeedPlayerId, finalPosition: lowSeedFinal });

    pairs.push({
      bracketRank: pair.bracketRank,
      positions: pair.positions,
      results: [
        netRow(pair.highSeedPlayerId, players, holes, highSeedFinal, !lowSeedWins),
        netRow(pair.lowSeedPlayerId, players, holes, lowSeedFinal, lowSeedWins),
      ],
    });
  }

  finalPositions.sort((a, b) => a.finalPosition - b.finalPosition);
  return { pairs, finalPositions };
}

function netTotal(
  playerId: string,
  players: Record<string, PlayoffPlayerInput>,
  holes: HoleInfo[],
): { grossTotal: number; strokesReceived: number; netTotal: number } {
  const p = players[playerId];
  let grossTotal = 0;
  let strokesReceived = 0;
  if (p) {
    for (const hole of holes) {
      const gross = p.grossByHole[hole.number];
      if (typeof gross === "number") {
        grossTotal += gross;
        strokesReceived += strokesForHole(p.handicap, hole.strokeIndex);
      }
    }
  }
  return { grossTotal, strokesReceived, netTotal: grossTotal - strokesReceived };
}

function netRow(
  playerId: string,
  players: Record<string, PlayoffPlayerInput>,
  holes: HoleInfo[],
  finalPosition: number,
  won: boolean,
) {
  const t = netTotal(playerId, players, holes);
  return { playerId, ...t, finalPosition, won };
}
