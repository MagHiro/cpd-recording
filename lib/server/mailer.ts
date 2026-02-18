import nodemailer from "nodemailer";

import { env } from "@/lib/env";

const isSmtpConfigured = Boolean(
  env.SMTP_HOST &&
  env.SMTP_PORT &&
  env.SMTP_USER &&
  env.SMTP_PASS &&
  env.SMTP_FROM,
);

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

export async function sendLoginCodeEmail(
  email: string,
  code: string,
): Promise<void> {
  const subject = "CPD ANZ Migrate - Recording Portal Login Code";
  const text = `Your login code is ${code}. It expires in ${env.LOGIN_CODE_TTL_MINUTES} minutes.`;
  const html = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#eef3ff;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#00194c;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(180deg,#f5f8ff 0%,#eef3ff 100%);padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border-radius:22px;overflow:hidden;border:1px solid #d9e5fb;background:#f2f7ff;">
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid #d9e5fb;background:#f7faff;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ff5f57;margin-right:6px;"></span>
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#febc2e;margin-right:6px;"></span>
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#28c840;"></span>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 28px 28px 28px;">
                <p style="margin:0 0 10px 0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#b66c00;">Private Access</p>
                <h1 style="margin:0;font-size:30px;line-height:1.2;color:#00194c;">Your login code</h1>
                <p style="margin:16px 0 0 0;font-size:15px;line-height:1.6;color:#4a5f93;">
                  Use the one-time code below to sign in to the ANZ Migrate CPD recording portal.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;">
                  <tr>
                    <td align="center" style="padding:14px;border-radius:14px;background:#ffffff;border:1px solid #d8e1f5;">
                      <p style="margin:0;font-size:36px;letter-spacing:0.22em;font-weight:700;color:#00194c;">${code}</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:14px 0 0 0;font-size:13px;line-height:1.6;color:#4a5f93;">
                  This code expires in <strong>${env.LOGIN_CODE_TTL_MINUTES} minutes</strong>.
                </p>
                <p style="margin:22px 0 0 0;font-size:12px;line-height:1.6;color:#6a7dab;">
                  If you did not request this email, you can safely ignore it.
                </p>
              </td>
            </tr>
          </table>
          <p style="max-width:620px;margin:14px auto 0 auto;font-size:11px;line-height:1.5;color:#6a7dab;">
            CPD ANZ Migrate Recording Portal
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

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
    html,
  });
}
