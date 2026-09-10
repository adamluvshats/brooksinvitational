import { NextRequest } from "next/server";
import { handle, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getTournamentAccess } from "@/lib/permissions";
import { getTournamentState } from "@/lib/tournament";
import { updateTournamentSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    await requireUser();
    const state = await getTournamentState(id);
    if (!state) throw new HttpError(404, "Tournament not found");
    return state;
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    const user = await requireUser();
    const access = await getTournamentAccess(user, id);
    if (!access.canManage) throw new HttpError(403, "Not allowed to manage this tournament");

    const data = updateTournamentSchema.parse(await req.json());
    const tournament = await prisma.tournament.update({ where: { id }, data });
    return { tournament };
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    const user = await requireUser();
    const access = await getTournamentAccess(user, id);
    // Only the site admin or creator may delete a tournament.
    const t = await prisma.tournament.findUnique({ where: { id }, select: { createdById: true } });
    if (!t) throw new HttpError(404, "Tournament not found");
    if (!access.siteAdmin && t.createdById !== user.id) {
      throw new HttpError(403, "Not allowed to delete this tournament");
    }
    await prisma.tournament.delete({ where: { id } });
    return { ok: true };
  });
}
