import { NextRequest } from "next/server";
import { handle, HttpError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { token, password } = (await req.json()) as { token?: string; password?: string };
    if (!token || !password || password.length < 6) {
      throw new HttpError(400, "Token and a password (min 6 chars) are required");
    }
    const user = await prisma.user.findFirst({
      where: { resetToken: token, resetTokenExpires: { gt: new Date() } },
    });
    if (!user) throw new HttpError(400, "Invalid or expired reset token");

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        resetToken: null,
        resetTokenExpires: null,
      },
    });
    return { ok: true };
  });
}
