import { NextRequest } from "next/server";
import { handle, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getTournamentAccess } from "@/lib/permissions";
import { createRoundSchema } from "@/lib/validation";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const user = await requireUser();
    const access = await getTournamentAccess(user, id);
    if (!access.canManage) throw new HttpError(403, "Not allowed to manage rounds");

    const data = createRoundSchema.parse(await req.json());

    const course = await prisma.course.findFirst({
      where: { id: data.courseId, tournamentId: id },
      select: { id: true },
    });
    if (!course) throw new HttpError(400, "Course does not belong to this tournament");

    const round = await prisma.round.create({
      data: {
        tournamentId: id,
        courseId: data.courseId,
        roundNumber: data.roundNumber,
        name: data.name,
        type: data.type,
        holeNumbers: data.holeNumbers,
      },
    });
    return { round };
  });
}
