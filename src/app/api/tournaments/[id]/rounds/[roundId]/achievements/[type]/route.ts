import { NextRequest } from "next/server";
import { handle, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getTournamentAccess } from "@/lib/permissions";
import { claimSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string; roundId: string; type: string }> };

function normalizeType(type: string): "LONGEST_DRIVE" | "CLOSEST_TO_PIN" {
  const t = type.toUpperCase();
  if (t === "LONGEST_DRIVE" || t === "LD") return "LONGEST_DRIVE";
  if (t === "CLOSEST_TO_PIN" || t === "CTP") return "CLOSEST_TO_PIN";
  throw new HttpError(400, "Unknown achievement type");
}

/**
 * Set/update the current Longest Drive or Closest To Pin holder for a round.
 * Any tournament participant may update it live as players beat each other.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id, roundId, type } = await params;
    const user = await requireUser();
    const access = await getTournamentAccess(user, id);
    if (!access.membership && !access.siteAdmin) {
      throw new HttpError(403, "You are not part of this tournament");
    }

    const achType = normalizeType(type);
    const data = claimSchema.parse(await req.json());

    const achievement = await prisma.achievement.findFirst({
      where: { roundId, type: achType, round: { tournamentId: id } },
    });
    if (!achievement) {
      throw new HttpError(400, "No hole has been designated for this contest yet");
    }

    const player = await prisma.tournamentPlayer.findFirst({
      where: { id: data.playerId, tournamentId: id },
      select: { id: true },
    });
    if (!player) throw new HttpError(400, "Unknown player");

    const existing = await prisma.achievementClaim.findUnique({
      where: { achievementId: achievement.id },
    });
    const claim = existing
      ? await prisma.achievementClaim.update({
          where: { achievementId: achievement.id },
          data: { playerId: data.playerId, distance: data.distance, unit: data.unit },
        })
      : await prisma.achievementClaim.create({
          data: {
            achievementId: achievement.id,
            playerId: data.playerId,
            distance: data.distance,
            unit: data.unit,
          },
        });
    return { claim };
  });
}
