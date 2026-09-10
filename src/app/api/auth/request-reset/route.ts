import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { handle } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail, isMailConfigured } from "@/lib/email";

/**
 * Begin a password reset. Generates a one-hour token and emails a reset link
 * via SMTP (Mailgun) when mail is configured. In non-production without mail
 * configured, the token is returned directly so the flow is testable.
 * Always responds with success so the endpoint can't enumerate accounts.
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

      const base = process.env.APP_URL ?? req.nextUrl.origin;
      const resetUrl = `${base}/reset?token=${token}`;

      const sent = await sendPasswordResetEmail(user.email, resetUrl).catch((err) => {
        console.error("Failed to send reset email:", err);
        return false;
      });

      // Only surface the token in dev when there is no mail provider to send it.
      if (!sent && !isMailConfigured() && process.env.NODE_ENV !== "production") {
        return { ok: true, token };
      }
    }
    return { ok: true };
  });
}
