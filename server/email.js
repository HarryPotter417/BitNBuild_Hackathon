import nodemailer from "nodemailer";

export async function sendVerificationEmail(email, token) {
  const host = process.env.SMTP_HOST;
  if (!host) throw new Error("SMTP_HOST is required for account verification.");
  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  const base = process.env.APP_URL;
  if (!base) throw new Error("APP_URL is required to create verification links.");
  await transport.sendMail({
    from: process.env.MAIL_FROM || "Fair Drop <no-reply@fairdrop.local>",
    to: email,
    subject: "Verify your Fair Drop account",
    text: `Verify your email: ${new URL(`/api/auth/verify?token=${encodeURIComponent(token)}`, base).toString()}`,
  });
}
