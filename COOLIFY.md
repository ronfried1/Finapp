# Coolify Deployment Notes

## Service
- Build context: repository root
- Dockerfile: `Dockerfile`
- Port: `3000`

## Required Secrets
- `DATABASE_URL`
- `APP_ENCRYPTION_KEY_BASE64`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `APP_PASSCODE_PEPPER`
- `CRON_SHARED_SECRET`

## Startup
1. Run migrations after each deploy:
   - `npx prisma migrate deploy`
2. Optional seed (once after first user login):
   - `npm run db:seed`

## Daily Sync Cron
Create Coolify cron job:
- Method: `POST`
- URL: `https://<your-domain>/api/cron/daily-sync`
- Header: `x-cron-secret: <CRON_SHARED_SECRET>`
- Schedule: once daily (e.g., 06:10)
