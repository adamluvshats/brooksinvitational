import { NextRequest } from "next/server";
import { handle, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getTournamentAccess } from "@/lib/permissions";
import { updateRoundSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string; roundId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id, roundId } = await params;
    const user = await requireUser();
    const access = await getTournamentAccess(user, id);
    if (!access.canManage) throw new HttpError(403, "Not allowed to manage rounds");

    const round = await prisma.round.findFirst({ where: { id: roundId, tournamentId: id } });
    if (!round) throw new HttpError(404, "Round not found");

    const data = updateRoundSchema.parse(await req.json());

    // Designate Longest Drive / Closest To Pin holes (upsert/clear Achievements).
    const setAchievement = async (type: "LONGEST_DRIVE" | "CLOSEST_TO_PIN", holeNumber: number | null) => {
      const existing = await prisma.achievement.findUnique({
        where: { roundId_type: { roundId, type } },
      });
      if (holeNumber === null) {
        if (existing) await prisma.achievement.delete({ where: { id: existing.id } });
        return;
      }
      if (existing) {
        await prisma.achievement.update({ where: { id: existing.id }, data: { holeNumber } });
      } else {
        await prisma.achievement.create({ data: { roundId, type, holeNumber } });
      }
    };

    if (data.longestDriveHole !== undefined) await setAchievement("LONGEST_DRIVE", data.longestDriveHole);
    if (data.closestToPinHole !== undefined) await setAchievement("CLOSEST_TO_PIN", data.closestToPinHole);

    const updated = await prisma.round.update({
      where: { id: roundId },
      data: {
        name: data.name,
        status: data.status,
        courseId: data.courseId,
        holeNumbers: data.holeNumbers,
      },
      include: { achievements: true },
    });
    return { round: updated };
  });
}
