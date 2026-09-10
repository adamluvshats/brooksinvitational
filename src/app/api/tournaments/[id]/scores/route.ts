import { NextRequest } from "next/server";
import { handle, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getTournamentAccess, canEditTeamScore } from "@/lib/permissions";
import { scoreSchema } from "@/lib/validation";

/**
 * Upsert a single gross hole score.
 *  - SCRAMBLE: one row per team per hole (playerId null).
 *  - PLAYOFF:  one row per player per hole (playerId set).
 * Players may only edit teams they're on; tournament/site admins may edit any.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const user = await requireUser();
    const access = await getTournamentAccess(user, id);
    if (!access.membership && !access.siteAdmin) {
      throw new HttpError(403, "You are not part of this tournament");
    }

    const data = scoreSchema.parse(await req.json());

    const round = await prisma.round.findFirst({
      where: { id: data.roundId, tournamentId: id },
      select: { id: true, type: true, holeNumbers: true, status: true },
    });
    if (!round) throw new HttpError(404, "Round not found");

    const holeNumbers = (round.holeNumbers as number[]) ?? [];
    if (!holeNumbers.includes(data.holeNumber)) {
      throw new HttpError(400, "Hole is not part of this round");
    }

    const team = await prisma.team.findFirst({
      where: { id: data.teamId, roundId: round.id },
      select: { id: true },
    });
    if (!team) throw new HttpError(400, "Team is not part of this round");

    if (!(await canEditTeamScore(access, data.teamId))) {
      throw new HttpError(403, "You can only edit your own team's scores");
    }

    const playerId = round.type === "PLAYOFF" ? data.playerId ?? null : null;
    if (round.type === "PLAYOFF" && !playerId) {
      throw new HttpError(400, "Playoff scores require a playerId");
    }

    // Done as find-then-update/create rather than upsert: Postgres unique
    // constraints treat NULL as distinct, so for scramble rows (playerId null)
    // the composite-unique upsert would never match and would insert duplicates.
    const existing = await prisma.holeScore.findFirst({
      where: {
        roundId: round.id,
        teamId: data.teamId,
        playerId,
        holeNumber: data.holeNumber,
      },
      select: { id: true },
    });

    const score = existing
      ? await prisma.holeScore.update({
          where: { id: existing.id },
          data: { strokes: data.strokes, updatedById: user.id },
        })
      : await prisma.holeScore.create({
          data: {
            roundId: round.id,
            teamId: data.teamId,
            playerId,
            holeNumber: data.holeNumber,
            strokes: data.strokes,
            updatedById: user.id,
          },
        });
    return { score };
  });
}

/** Delete a hole score (clear an entry). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const user = await requireUser();
    const access = await getTournamentAccess(user, id);
    const { searchParams } = new URL(req.url);
    const scoreId = searchParams.get("scoreId");
    if (!scoreId) throw new HttpError(400, "scoreId required");

    const score = await prisma.holeScore.findFirst({
      where: { id: scoreId, round: { tournamentId: id } },
      select: { id: true, teamId: true },
    });
    if (!score) throw new HttpError(404, "Score not found");
    if (!(await canEditTeamScore(access, score.teamId))) {
      throw new HttpError(403, "Not allowed to delete this score");
    }
    await prisma.holeScore.delete({ where: { id: scoreId } });
    return { ok: true };
  });
}
