import { NextRequest } from "next/server";
import { handle, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const data = registerSchema.parse(await req.json());
    const existing = await prisma.user.findFirst({
      where: { OR: [{ username: data.username }, { email: data.email }] },
      select: { id: true, username: true },
    });
    if (existing) throw new HttpError(409, "Username or email already in use");

    // The very first registered user becomes the site administrator.
    const isFirst = (await prisma.user.count()) === 0;

    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email.toLowerCase(),
        passwordHash: await hashPassword(data.password),
        displayName: data.displayName,
        role: isFirst ? "ADMIN" : "USER",
      },
    });
    await createSession(user);
    return { id: user.id, username: user.username, displayName: user.displayName, role: user.role };
  });
}
