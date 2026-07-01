import { prisma } from "./prisma";
import {
  scoreScrambleRound,
  scrambleRoundPlayerPoints,
  teamHandicap,
  computeStandings,
  sumPoints,
  buildPlayoffBracket,
  resolvePlayoff,
  type HoleInfo,
  type ScrambleTeamInput,
  type ScrambleHandicapMode,
  type PlayoffPlayerInput,
  type StandingRow,
} from "./scoring";

/** Load a tournament with everything needed to compute its state. */
export async function loadTournament(tournamentId: string) {
  return prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      players: { orderBy: { displayName: "asc" } },
      courses: { include: { holes: { orderBy: { number: "asc" } } } },
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: {
          course: { include: { holes: true } },
          teams: { include: { members: { include: { player: true } } } },
          holeScores: true,
          achievements: { include: { claim: { include: { player: true } } } },
        },
      },
    },
  });
}

export type LoadedTournament = NonNullable<Awaited<ReturnType<typeof loadTournament>>>;
type LoadedRound = LoadedTournament["rounds"][number];

function holesForRound(round: LoadedRound): HoleInfo[] {
  const byNumber = new Map(round.course.holes.map((h) => [h.number, h]));
  const order = (round.holeNumbers as number[]) ?? [];
  return order
    .map((n) => byNumber.get(n))
    .filter((h): h is NonNullable<typeof h> => Boolean(h))
    .map((h) => ({ number: h.number, par: h.par, strokeIndex: h.strokeIndex }));
}

function deriveTeamHandicap(
  team: LoadedRound["teams"][number],
  mode: ScrambleHandicapMode,
): number {
  const hcaps = team.members.map((m) => m.player.handicap);
  if (hcaps.length === 0) return 0;
  if (hcaps.length === 1) return hcaps[0];
  return teamHandicap(hcaps[0], hcaps[1], mode);
}

export interface RoundComputation {
  roundId: string;
  roundNumber: number;
  name: string;
  type: "SCRAMBLE" | "PLAYOFF";
  status: string;
  holes: HoleInfo[];
  pointsByPlayer: Record<string, number>;
  /** Scramble only: per-hole results for the scorecard view. */
  holeResults?: ReturnType<typeof scoreScrambleRound>["holeResults"];
  teamHandicaps?: Record<string, number>;
  achievements: {
    type: "LONGEST_DRIVE" | "CLOSEST_TO_PIN";
    holeNumber: number;
    holderPlayerId: string | null;
    distance: number | null;
    unit: string | null;
  }[];
}

/** Compute one round's results (scramble points or playoff — playoff handled separately). */
function computeScrambleRound(
  round: LoadedRound,
  mode: ScrambleHandicapMode,
  pointsPerHole: number,
): RoundComputation {
  const holes = holesForRound(round);

  const teamInputs: ScrambleTeamInput[] = round.teams.map((team) => {
    const grossByHole: Record<number, number | undefined> = {};
    for (const s of round.holeScores) {
      if (s.teamId === team.id && s.playerId === null) {
        grossByHole[s.holeNumber] = s.strokes;
      }
    }
    return {
      teamId: team.id,
      playerIds: team.members.map((m) => m.playerId),
      handicap: deriveTeamHandicap(team, mode),
      grossByHole,
    };
  });

  const result = scoreScrambleRound(teamInputs, holes, pointsPerHole);
  const achievements = round.achievements.map((a) => ({
    type: a.type as "LONGEST_DRIVE" | "CLOSEST_TO_PIN",
    playerId: a.claim?.playerId ?? null,
  }));
  const pointsByPlayer = scrambleRoundPlayerPoints(result, achievements);

  return {
    roundId: round.id,
    roundNumber: round.roundNumber,
    name: round.name,
    type: "SCRAMBLE",
    status: round.status,
    holes,
    pointsByPlayer,
    holeResults: result.holeResults,
    teamHandicaps: Object.fromEntries(teamInputs.map((t) => [t.teamId, t.handicap])),
    achievements: round.achievements.map((a) => ({
      type: a.type as "LONGEST_DRIVE" | "CLOSEST_TO_PIN",
      holeNumber: a.holeNumber,
      holderPlayerId: a.claim?.playerId ?? null,
      distance: a.claim?.distance ?? null,
      unit: a.claim?.unit ?? null,
    })),
  };
}

export interface TournamentState {
  tournamentId: string;
  name: string;
  status: string;
  handicapMode: string;
  pointsPerHole: number;
  rounds: RoundComputation[];
  /** Total points per player across all scramble rounds. */
  totalPoints: Record<string, number>;
  standings: StandingRow[];
  playoff: ReturnType<typeof resolvePlayoff> | null;
  /** Final 1..N positions after the playoff, if it has been played. */
  finalPositions: { playerId: string; finalPosition: number }[] | null;
  players: { id: string; displayName: string; handicap: number; handicapClass: string; userId: string | null; role: string }[];
}

export function computeTournamentState(t: LoadedTournament): TournamentState {
  const mode = t.handicapMode as ScrambleHandicapMode;
  const scrambleRounds = t.rounds.filter((r) => r.type === "SCRAMBLE");
  const playoffRound = t.rounds.find((r) => r.type === "PLAYOFF");

  const roundComputations = scrambleRounds.map((r) =>
    computeScrambleRound(r, mode, t.pointsPerHole),
  );

  const totalPoints = sumPoints(roundComputations.map((r) => r.pointsByPlayer));
  const playerIds = t.players.map((p) => p.id);
  // Ensure every player appears even with 0 points.
  for (const id of playerIds) if (!(id in totalPoints)) totalPoints[id] = 0;

  const handicapById = new Map(t.players.map((p) => [p.id, p.handicap]));
  const nameById = new Map(t.players.map((p) => [p.id, p.displayName]));
  const standings = computeStandings(totalPoints, playerIds, (a, b) =>
    (nameById.get(a) ?? "").localeCompare(nameById.get(b) ?? ""),
  );

  let playoff: TournamentState["playoff"] = null;
  let finalPositions: TournamentState["finalPositions"] = null;
  const rounds: RoundComputation[] = [...roundComputations];

  if (playoffRound) {
    const holes = holesForRound(playoffRound);
    const bracket = buildPlayoffBracket(standings);
    const players: Record<string, PlayoffPlayerInput> = {};
    for (const p of t.players) {
      const grossByHole: Record<number, number | undefined> = {};
      for (const s of playoffRound.holeScores) {
        if (s.playerId === p.id) grossByHole[s.holeNumber] = s.strokes;
      }
      players[p.id] = { playerId: p.id, handicap: p.handicap, grossByHole };
    }
    playoff = resolvePlayoff(bracket, players, holes);
    finalPositions = playoff.finalPositions;

    rounds.push({
      roundId: playoffRound.id,
      roundNumber: playoffRound.roundNumber,
      name: playoffRound.name,
      type: "PLAYOFF",
      status: playoffRound.status,
      holes,
      pointsByPlayer: {},
      achievements: [],
    });
  }

  return {
    tournamentId: t.id,
    name: t.name,
    status: t.status,
    handicapMode: t.handicapMode,
    pointsPerHole: t.pointsPerHole,
    rounds,
    totalPoints,
    standings,
    playoff,
    finalPositions,
    players: t.players.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      handicap: p.handicap,
      handicapClass: p.handicapClass,
      userId: p.userId,
      role: p.role,
    })),
  };
}

export async function getTournamentState(tournamentId: string): Promise<TournamentState | null> {
  const t = await loadTournament(tournamentId);
  if (!t) return null;
  return computeTournamentState(t);
}
