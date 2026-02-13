import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  POSTGRES_URL: z.string().optional().default(""),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_COOKIE_NAME: z.string().default("rv_session"),
  ADMIN_SESSION_COOKIE_NAME: z.string().default("rv_admin_session"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 chars"),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(12, "ADMIN_PASSWORD must be at least 12 chars"),
  ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(48).default(12),
  LOGIN_CODE_TTL_MINUTES: z.coerce.number().int().min(3).max(30).default(10),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  N8N_WEBHOOK_SECRET: z.string().min(16, "N8N_WEBHOOK_SECRET must be set"),
  N8N_TIMESTAMP_TOLERANCE_SECONDS: z.coerce.number().int().min(30).max(900).default(300),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_OAUTH_REFRESH_TOKEN: z.string().optional().default(""),
  GOOGLE_DRIVE_CONNECT_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_DRIVE_SCOPES: z.string().default("https://www.googleapis.com/auth/drive.readonly"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${lines.join("\n")}`);
}

export const env = {
  ...parsed.data,
  GOOGLE_DRIVE_CONNECT_REDIRECT_URI:
    parsed.data.GOOGLE_DRIVE_CONNECT_REDIRECT_URI ?? `${parsed.data.APP_URL}/api/admin/google/connect/callback`,
};
