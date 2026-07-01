import nodemailer from "nodemailer";

/**
 * SMTP mail via Mailgun (or any SMTP server). Configure with env vars:
 *   SMTP_HOST        (default: smtp.mailgun.org)
 *   SMTP_PORT        (default: 587)
 *   SMTP_USER        Mailgun SMTP login, e.g. postmaster@mg.yourdomain.com
 *   SMTP_PASS        Mailgun SMTP password
 *   MAIL_FROM        From address, e.g. "Brooks Invitational <no-reply@yourdomain.com>"
 * If SMTP_USER/SMTP_PASS are absent, email is considered unconfigured (no send).
 */
export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transport() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.mailgun.org",
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
    // Don't let a slow/misconfigured SMTP server hang the reset request.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

function fromAddress(): string {
  return process.env.MAIL_FROM ?? `Brooks Invitational <no-reply@${mailDomain()}>`;
}

function mailDomain(): string {
  // Best-effort domain for a default From when MAIL_FROM is unset.
  const user = process.env.SMTP_USER ?? "";
  const at = user.indexOf("@");
  return at >= 0 ? user.slice(at + 1) : "example.com";
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  if (!isMailConfigured()) return false;
  await transport().sendMail({
    from: fromAddress(),
    to,
    subject: "Reset your Brooks Invitational password",
    text: `Someone requested a password reset for your Brooks Invitational account.

Reset your password here (valid for 1 hour):
${resetUrl}

If you didn't request this, you can ignore this email.`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto">
  <h2 style="color:#2d6536">⛳ Brooks Invitational</h2>
  <p>Someone requested a password reset for your account.</p>
  <p><a href="${resetUrl}" style="display:inline-block;background:#2d6536;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">Reset your password</a></p>
  <p style="color:#555;font-size:13px">This link is valid for 1 hour. If you didn't request this, you can safely ignore this email.</p>
  <p style="color:#888;font-size:12px;word-break:break-all">${resetUrl}</p>
</div>`,
  });
  return true;
}
