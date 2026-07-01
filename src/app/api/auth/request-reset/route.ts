import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/**
 * Begin a password reset. Email delivery is intentionally pluggable — there is
 * no mail provider wired up, so in non-production the reset token is returned
 * directly. In production, send `token` to the user's email and drop it from
 * the response (see README "Password resets").
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const { email } = (await req.json()) as { email?: string };
    const user = email
      ? await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
      : null;

    if (user) {
      const token = randomBytes(24).toString("hex");
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: token, resetTokenExpires: new Date(Date.now() + 1000 * 60 * 60) },
      });
      // TODO: email the token to user.email via your provider.
      if (process.env.NODE_ENV !== "production") {
        return { ok: true, token };
      }
    }
    // Always report success so the endpoint can't be used to enumerate accounts.
    return { ok: true };
  });
}
