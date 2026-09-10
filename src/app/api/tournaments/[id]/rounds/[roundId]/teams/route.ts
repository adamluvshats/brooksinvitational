import { NextRequest } from "next/server";
import { handle, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getTournamentAccess } from "@/lib/permissions";
import { setTeamsSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string; roundId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id, roundId } = await params;
    await requireUser();
    const [teams, holeScores, achievements] = await Promise.all([
      prisma.team.findMany({
        where: { roundId, round: { tournamentId: id } },
        include: { members: { include: { player: true } } },
        orderBy: { bracketRank: "asc" },
      }),
      prisma.holeScore.findMany({ where: { roundId, round: { tournamentId: id } } }),
      prisma.achievement.findMany({
        where: { roundId, round: { tournamentId: id } },
        include: { claim: { include: { player: true } } },
      }),
    ]);
    return { teams, holeScores, achievements };
  });
}

/** Replace the round's teams (round-robin pairings change every round). */
export async function PUT(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id, roundId } = await params;
    const user = await requireUser();
    const access = await getTournamentAccess(user, id);
    if (!access.canManage) throw new HttpError(403, "Not allowed to set pairings");

    const round = await prisma.round.findFirst({ where: { id: roundId, tournamentId: id } });
    if (!round) throw new HttpError(404, "Round not found");

    const data = setTeamsSchema.parse(await req.json());

    // Validate all players belong to the tournament.
    const playerIds = data.teams.flatMap((t) => t.playerIds);
    const valid = await prisma.tournamentPlayer.count({
      where: { tournamentId: id, id: { in: playerIds } },
    });
    if (valid !== playerIds.length) throw new HttpError(400, "Unknown player in pairing");

    await prisma.$transaction(async (tx) => {
      // Replacing teams removes their hole scores too (cascade), so only do this
      // before scores are entered, or when intentionally re-pairing.
      await tx.team.deleteMany({ where: { roundId } });
      for (const t of data.teams) {
        await tx.team.create({
          data: {
            roundId,
            name: t.name,
            members: { create: t.playerIds.map((playerId) => ({ playerId })) },
          },
        });
      }
    });

    const teams = await prisma.team.findMany({
      where: { roundId },
      include: { members: { include: { player: true } } },
    });
    return { teams };
  });
}
