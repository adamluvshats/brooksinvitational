import { NextRequest } from "next/server";
import { handle, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getTournamentAccess } from "@/lib/permissions";
import { createCourseSchema } from "@/lib/validation";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    await requireUser();
    const courses = await prisma.course.findMany({
      where: { tournamentId: id },
      include: { holes: { orderBy: { number: "asc" } } },
    });
    return { courses };
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const user = await requireUser();
    const access = await getTournamentAccess(user, id);
    if (!access.canManage) throw new HttpError(403, "Not allowed to manage courses");

    const data = createCourseSchema.parse(await req.json());

    // Validate hole numbers 1-18 unique and stroke indexes 1-18 unique.
    const numbers = new Set(data.holes.map((h) => h.number));
    const indexes = new Set(data.holes.map((h) => h.strokeIndex));
    if (numbers.size !== 18 || indexes.size !== 18) {
      throw new HttpError(400, "Holes must have unique numbers 1-18 and unique stroke indexes 1-18");
    }

    const course = await prisma.course.create({
      data: {
        tournamentId: id,
        name: data.name,
        holes: { create: data.holes },
      },
      include: { holes: { orderBy: { number: "asc" } } },
    });
    return { course };
  });
}
