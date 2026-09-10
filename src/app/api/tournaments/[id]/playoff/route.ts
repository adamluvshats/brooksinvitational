import { NextRequest } from "next/server";
import { handle, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getTournamentAccess } from "@/lib/permissions";
import { loadTournament, computeTournamentState } from "@/lib/tournament";
import { buildPlayoffBracket } from "@/lib/scoring";
import { z } from "zod";

const bodySchema = z.object({
  courseId: z.string(),
  holeNumbers: z.array(z.number().int().min(1).max(18)).min(1).max(18),
  roundNumber: z.number().int().min(1).max(8).default(8),
  name: z.string().min(1).max(120).default("Playoff"),
});

/**
 * Generate (or regenerate) the playoff round from the current standings:
 * seeds 1v2, 3v4, 5v6, 7v8 etc. Each pair becomes a Team with a bracketRank.
 * Stroke-play scores are then entered per player.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const user = await requireUser();
    const access = await getTournamentAccess(user, id);
    if (!access.canManage) throw new HttpError(403, "Not allowed to manage the playoff");

    const data = bodySchema.parse(await req.json());

    const loaded = await loadTournament(id);
    if (!loaded) throw new HttpError(404, "Tournament not found");

    const course = loaded.courses.find((c) => c.id === data.courseId);
    if (!course) throw new HttpError(400, "Course does not belong to this tournament");

    const state = computeTournamentState(loaded);
    const bracket = buildPlayoffBracket(state.standings);

    const nameById = new Map(loaded.players.map((p) => [p.id, p.displayName]));

    const round = await prisma.$transaction(async (tx) => {
      // Find or create the playoff round.
      let playoff = await tx.round.findFirst({ where: { tournamentId: id, type: "PLAYOFF" } });
      if (playoff) {
        await tx.team.deleteMany({ where: { roundId: playoff.id } });
        playoff = await tx.round.update({
          where: { id: playoff.id },
          data: {
            courseId: data.courseId,
            holeNumbers: data.holeNumbers,
            name: data.name,
            status: "ACTIVE",
          },
        });
      } else {
        playoff = await tx.round.create({
          data: {
            tournamentId: id,
            courseId: data.courseId,
            roundNumber: data.roundNumber,
            name: data.name,
            type: "PLAYOFF",
            status: "ACTIVE",
            holeNumbers: data.holeNumbers,
          },
        });
      }

      for (const pair of bracket) {
        const memberIds = [pair.highSeedPlayerId, pair.lowSeedPlayerId].filter(
          (x): x is string => Boolean(x),
        );
        const label = memberIds.map((m) => nameById.get(m) ?? "?").join(" vs ");
        await tx.team.create({
          data: {
            roundId: playoff.id,
            bracketRank: pair.bracketRank,
            name: `#${pair.positions[0]}/#${pair.positions[1]}: ${label}`,
            members: { create: memberIds.map((playerId) => ({ playerId })) },
          },
        });
      }

      await tx.tournament.update({ where: { id }, data: { status: "PLAYOFF" } });
      return playoff;
    });

    return { round, bracket };
  });
}
