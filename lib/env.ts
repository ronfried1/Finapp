import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  APP_ENCRYPTION_KEY_BASE64: z.string().min(1),
  APP_PASSCODE_PEPPER: z.string().min(1),
  CRON_SHARED_SECRET: z.string().min(1)
});

export const env = EnvSchema.parse(process.env);
