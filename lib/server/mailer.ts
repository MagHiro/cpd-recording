import nodemailer from "nodemailer";

import { env } from "@/lib/env";

const isSmtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM);

const transporter = isSmtpConfigured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    })
  : null;

export async function sendLoginCodeEmail(email: string, code: string): Promise<void> {
  const subject = "Your Recording Vault login code";
  const text = `Your login code is ${code}. It expires in ${env.LOGIN_CODE_TTL_MINUTES} minutes.`;

  if (!transporter) {
    if (env.NODE_ENV === "development") {
      console.log(`[DEV LOGIN CODE] ${email}: ${code}`);
      return;
    }

    throw new Error("SMTP is not configured in production.");
  }

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject,
    text,
  });
}
