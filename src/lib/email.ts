import { Resend } from "resend";

/**
 * Transactional email via Resend (https://resend.com). Configure with env vars:
 *   RESEND_API_KEY   Your Resend API key (starts with "re_"). Required to send.
 *   MAIL_FROM        From address on a domain you've verified in Resend, e.g.
 *                    "Brooks Invitational <noreply@brooksinvitational.com>".
 *
 * If RESEND_API_KEY is absent, email is considered unconfigured and no send
 * happens (callers degrade gracefully — e.g. the reset flow returns its token
 * directly in non-production so it stays testable).
 */
export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function client(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}

function fromAddress(): string {
  return (
    process.env.MAIL_FROM ??
    "Brooks Invitational <noreply@brooksinvitational.com>"
  );
}

// Shared wrapper so every branded message looks consistent.
function shell(bodyHtml: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:8px 4px;color:#1a2b1e">
  <h2 style="color:#2d6536;margin:0 0 16px">⛳ Brooks Invitational</h2>
  ${bodyHtml}
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
  <p style="color:#9ca3af;font-size:12px;margin:0">Brooks Invitational — live tournament scoring.</p>
</div>`;
}

/**
 * Welcome / registration confirmation. Sent (best-effort) when a new account
 * is created. Returns true if a send was attempted successfully, false if mail
 * is unconfigured. Throws only on an unexpected Resend error, so callers should
 * catch — a failed welcome email must never block registration.
 */
export async function sendWelcomeEmail(
  to: string,
  displayName: string,
): Promise<boolean> {
  if (!isMailConfigured()) return false;
  const appUrl = process.env.APP_URL ?? "https://brooksinvitational.com";
  const { error } = await client().emails.send({
    from: fromAddress(),
    to,
    subject: "Welcome to the Brooks Invitational ⛳",
    text: `Hi ${displayName},

Your Brooks Invitational account is all set. You can log in, join a tournament,
track live scores, claim Longest Drive / Closest to Pin, and talk some smack.

Log in: ${appUrl}/login

See you on the course.`,
    html: shell(`<p style="font-size:15px;line-height:1.5">Hi ${escapeHtml(displayName)},</p>
  <p style="font-size:15px;line-height:1.5">Your account is all set. Log in to join a tournament, track live scores,
  claim Longest Drive / Closest to Pin, and talk some smack.</p>
  <p style="margin:20px 0"><a href="${appUrl}/login" style="display:inline-block;background:#2d6536;color:#fff;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:600">Log in</a></p>
  <p style="color:#6b7280;font-size:13px">See you on the course.</p>`),
  });
  if (error) throw new Error(`Resend welcome email failed: ${error.message ?? error}`);
  return true;
}

/**
 * Password reset link (valid for 1 hour). Returns true if a send was attempted,
 * false if mail is unconfigured. Throws on Resend errors so the caller can log.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<boolean> {
  if (!isMailConfigured()) return false;
  const { error } = await client().emails.send({
    from: fromAddress(),
    to,
    subject: "Reset your Brooks Invitational password",
    text: `Someone requested a password reset for your Brooks Invitational account.

Reset your password here (valid for 1 hour):
${resetUrl}

If you didn't request this, you can ignore this email.`,
    html: shell(`<p style="font-size:15px;line-height:1.5">Someone requested a password reset for your account.</p>
  <p style="margin:20px 0"><a href="${resetUrl}" style="display:inline-block;background:#2d6536;color:#fff;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:600">Reset your password</a></p>
  <p style="color:#6b7280;font-size:13px">This link is valid for 1 hour. If you didn't request this, you can safely ignore this email.</p>
  <p style="color:#9ca3af;font-size:12px;word-break:break-all">${resetUrl}</p>`),
  });
  if (error) throw new Error(`Resend reset email failed: ${error.message ?? error}`);
  return true;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
