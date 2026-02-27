process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/test?schema=public";
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? "test-secret";
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
process.env.AUTH_GOOGLE_ID = process.env.AUTH_GOOGLE_ID ?? "google-id";
process.env.AUTH_GOOGLE_SECRET = process.env.AUTH_GOOGLE_SECRET ?? "google-secret";
process.env.APP_ENCRYPTION_KEY_BASE64 = process.env.APP_ENCRYPTION_KEY_BASE64 ?? Buffer.alloc(32, 1).toString("base64");
process.env.APP_PASSCODE_PEPPER = process.env.APP_PASSCODE_PEPPER ?? "pepper";
process.env.CRON_SHARED_SECRET = process.env.CRON_SHARED_SECRET ?? "cron-secret";
