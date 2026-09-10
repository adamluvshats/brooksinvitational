import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { loadTournament, computeTournamentState } from "@/lib/tournament";
import { PAST_WINNERS } from "@/lib/history";

/**
 * Public (no-auth) data for the landing page: the most recent live/complete
 * tournament's leaderboard, plus the Hall of Champions (completed tournaments
 * in the DB merged with the static pre-app history).
 */
export async function GET() {
  return handle(async () => {
    // Featured = most recent tournament that's underway or finished.
    const featuredRow = await prisma.tournament.findFirst({
      where: { status: { in: ["ACTIVE", "PLAYOFF", "COMPLETE"] } },
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });

    let featured: {
      name: string;
      year: number;
      status: string;
      standings: { rank: number; name: string; points: number; handicapClass: string }[];
    } | null = null;

    if (featuredRow) {
      const loaded = await loadTournament(featuredRow.id);
      if (loaded) {
        const state = computeTournamentState(loaded);
        const nameById = new Map(state.players.map((p) => [p.id, p]));
        featured = {
          name: state.name,
          year: loaded.year,
          status: state.status,
          standings: state.standings.slice(0, 10).map((s) => {
            const p = nameById.get(s.playerId);
            return {
              rank: s.rank,
              name: p?.displayName ?? "?",
              points: s.points,
              handicapClass: p?.handicapClass ?? "",
            };
          }),
        };
      }
    }

    // Champions from completed tournaments in the DB.
    const completed = await prisma.tournament.findMany({
      where: { status: "COMPLETE" },
      orderBy: { year: "desc" },
      select: { id: true, year: true },
    });
    const dbChampions: { year: number; champion: string; runnerUp?: string }[] = [];
    for (const t of completed) {
      const loaded = await loadTournament(t.id);
      if (!loaded) continue;
      const state = computeTournamentState(loaded);
      if (!state.finalPositions?.length) continue;
      const nameById = new Map(state.players.map((p) => [p.id, p.displayName]));
      const first = state.finalPositions.find((f) => f.finalPosition === 1);
      const second = state.finalPositions.find((f) => f.finalPosition === 2);
      if (first) {
        dbChampions.push({
          year: t.year,
          champion: nameById.get(first.playerId) ?? "?",
          runnerUp: second ? nameById.get(second.playerId) : undefined,
        });
      }
    }

    // Merge: DB champions take precedence over static history for the same year.
    const byYear = new Map<number, { year: number; champion: string; runnerUp?: string }>();
    for (const w of PAST_WINNERS) byYear.set(w.year, w);
    for (const w of dbChampions) byYear.set(w.year, w);
    const champions = [...byYear.values()].sort((a, b) => b.year - a.year);

    return { featured, champions };
  });
}
