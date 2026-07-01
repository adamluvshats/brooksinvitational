import { NextRequest } from "next/server";
import { handle, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getTournamentAccess } from "@/lib/permissions";
import { addPlayerSchema } from "@/lib/validation";
import { classToHandicap, type HandicapClass } from "@/lib/scoring";

const MAX_PLAYERS = 16;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const user = await requireUser();
    const access = await getTournamentAccess(user, id);
    if (!access.canManage) throw new HttpError(403, "Not allowed to manage players");

    const data = addPlayerSchema.parse(await req.json());

    const count = await prisma.tournamentPlayer.count({ where: { tournamentId: id } });
    if (count >= MAX_PLAYERS) throw new HttpError(400, `Maximum of ${MAX_PLAYERS} players`);

    const handicap = data.handicap ?? classToHandicap(data.handicapClass as HandicapClass);

    const player = await prisma.tournamentPlayer.create({
      data: {
        tournamentId: id,
        userId: data.userId || null,
        displayName: data.displayName,
        handicapClass: data.handicapClass,
        handicap,
        role: data.role,
      },
    });
    return { player };
  });
}
