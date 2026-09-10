import { NextRequest } from "next/server";
import { handle, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getTournamentAccess } from "@/lib/permissions";
import { updatePlayerSchema } from "@/lib/validation";
import { classToHandicap, type HandicapClass } from "@/lib/scoring";

type Params = { params: Promise<{ id: string; playerId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id, playerId } = await params;
    const user = await requireUser();
    const access = await getTournamentAccess(user, id);

    const player = await prisma.tournamentPlayer.findFirst({
      where: { id: playerId, tournamentId: id },
    });
    if (!player) throw new HttpError(404, "Player not found");

    const data = updatePlayerSchema.parse(await req.json());

    // A plain player may only edit their own display name / linked profile,
    // not handicap or role. Managers may edit anything.
    const isSelf = access.membership?.id === playerId;
    if (!access.canManage && !isSelf) {
      throw new HttpError(403, "Not allowed to edit this player");
    }
    if (!access.canManage && (data.handicap !== undefined || data.handicapClass || data.role)) {
      throw new HttpError(403, "Only an admin can change handicap or role");
    }

    // If class changes without an explicit handicap, derive the handicap from it.
    const handicap =
      data.handicap ??
      (data.handicapClass ? classToHandicap(data.handicapClass as HandicapClass) : undefined);

    const updated = await prisma.tournamentPlayer.update({
      where: { id: playerId },
      data: {
        displayName: data.displayName,
        handicapClass: data.handicapClass,
        handicap,
        role: access.canManage ? data.role : undefined,
        userId: access.canManage ? data.userId ?? undefined : undefined,
      },
    });
    return { player: updated };
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id, playerId } = await params;
    const user = await requireUser();
    const access = await getTournamentAccess(user, id);
    if (!access.canManage) throw new HttpError(403, "Not allowed to remove players");
    const player = await prisma.tournamentPlayer.findFirst({
      where: { id: playerId, tournamentId: id },
      select: { id: true },
    });
    if (!player) throw new HttpError(404, "Player not found");
    await prisma.tournamentPlayer.delete({ where: { id: playerId } });
    return { ok: true };
  });
}
