import { NextRequest } from "next/server";
import { handle, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getTournamentAccess } from "@/lib/permissions";
import { chatSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    await requireUser();
    const { searchParams } = new URL(req.url);
    const since = searchParams.get("since");
    const messages = await prisma.chatMessage.findMany({
      where: { tournamentId: id, ...(since ? { createdAt: { gt: new Date(since) } } : {}) },
      orderBy: { createdAt: "asc" },
      take: 200,
      include: {
        user: { select: { id: true, displayName: true, username: true } },
        mentions: { include: { player: { select: { id: true, displayName: true } } } },
      },
    });
    return { messages };
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    const user = await requireUser();
    const access = await getTournamentAccess(user, id);
    if (!access.membership && !access.siteAdmin) {
      throw new HttpError(403, "You are not part of this tournament");
    }

    const data = chatSchema.parse(await req.json());

    // Keep only mention ids that are real players in this tournament.
    let mentionIds: string[] = [];
    if (data.mentionPlayerIds?.length) {
      const players = await prisma.tournamentPlayer.findMany({
        where: { tournamentId: id, id: { in: data.mentionPlayerIds } },
        select: { id: true },
      });
      mentionIds = players.map((p) => p.id);
    }

    const message = await prisma.chatMessage.create({
      data: {
        tournamentId: id,
        userId: user.id,
        body: data.body,
        mentions: { create: mentionIds.map((playerId) => ({ playerId })) },
      },
      include: {
        user: { select: { id: true, displayName: true, username: true } },
        mentions: { include: { player: { select: { id: true, displayName: true } } } },
      },
    });
    return { message };
  });
}
