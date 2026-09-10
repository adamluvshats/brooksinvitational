import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { createTournamentSchema } from "@/lib/validation";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    // Site admins see all; others see tournaments they belong to or created.
    const where =
      user.role === "ADMIN"
        ? {}
        : {
            OR: [
              { createdById: user.id },
              { players: { some: { userId: user.id } } },
            ],
          };
    const tournaments = await prisma.tournament.findMany({
      where,
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
      include: { _count: { select: { players: true, rounds: true } } },
    });
    return { tournaments };
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const data = createTournamentSchema.parse(await req.json());
    const tournament = await prisma.tournament.create({
      data: {
        name: data.name,
        year: data.year,
        handicapMode: data.handicapMode,
        createdById: user.id,
        // The creator joins as a tournament admin so they can manage it.
        players: {
          create: {
            userId: user.id,
            displayName: user.displayName,
            handicapClass: "SCRATCH",
            handicap: 0,
            role: "TOURNAMENT_ADMIN",
          },
        },
      },
    });
    return { tournament };
  });
}
