import { NextRequest } from "next/server";
import { handle, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const data = loginSchema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { username: data.username } });
    if (!user || !(await verifyPassword(data.password, user.passwordHash))) {
      throw new HttpError(401, "Invalid username or password");
    }
    await createSession(user);
    return { id: user.id, username: user.username, displayName: user.displayName, role: user.role };
  });
}
