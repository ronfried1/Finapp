# Personal Finance Dashboard MVP

A Next.js dashboard focused on spending clarity for Israeli bank and credit-card accounts.

## Stack
- Next.js (App Router, TypeScript)
- Prisma + PostgreSQL/SQLite (env-controlled)
- NextAuth (Google OAuth)
- AES-256-GCM app-layer encryption for sensitive fields
- `israeli-bank-scrapers` for live bank/card sync

## Runtime Requirement
- For live scraping mode, use Node.js `>=22.12.0` (package requirement from `israeli-bank-scrapers`).

## Quick Start
1. Install dependencies:
   `npm install`
2. Copy env template:
   `cp .env.example .env`
3. Set database mode in `.env`:
   - `APP_DB_PROVIDER="postgresql"` and PostgreSQL `DATABASE_URL`, or
   - `APP_DB_PROVIDER="sqlite"` and `DATABASE_URL="file:./dev.db"`
4. Prepare Prisma schema/client for selected provider:
   `npm run db:prepare`
5. Create/update DB schema:
   - Postgres: `npm run db:migrate -- --name init`
   - SQLite: `npm run db:push`
6. Seed categories:
   `npx prisma db seed`
7. Start app:
   `npm run dev`

## Database Provider Switching
- The active Prisma schema is selected from env:
  - `prisma/schema.postgresql.prisma`
  - `prisma/schema.sqlite.prisma`
- Run `npm run db:sync-schema` when switching providers.
- Then run `npm run db:prepare` to regenerate Prisma client.

## Required Environment
See `.env.example`.

## Daily Auto Sync (Coolify Cron)
Configure Coolify cron to call:
`POST /api/cron/daily-sync`
with header:
`x-cron-secret: <CRON_SHARED_SECRET>`

## Security Model
- Credentials and scraper session blobs are encrypted with AES-256-GCM before DB persistence.
- No raw secrets or OTP values are logged.
- Optional app passcode adds second lock layer after OAuth login.
- Encrypted backup export/import APIs:
  - `GET /api/security/backup/export`
  - `POST /api/security/backup/import`

## Current Notes
- `israeli-bank-scrapers` adapter is wired behind a service layer.
- Supported live institutions: Discount, Max, Cal, Isracard.
- For local development without live bank credentials, fallback mock sync data is generated.

## Live Bank/Card Connection
1. In `.env`, set:
   - `USE_SCRAPER_MOCK="false"`
   - `SCRAPER_START_DAYS="365"` (optional)
2. Start app and open `/accounts`.
3. Add one connection per institution:
   - Discount: `institution=discount`, login `username` (ID), `password`, and `accountNumber` (`num`).
   - Max: `institution=max`, login `username`, `password`.
   - Cal: `institution=cal`, login `username`, `password`.
   - Isracard: `institution=isracard`, login `username` (ID), `password`, and `card6Digits`.
4. Click `Sync now`.

## App Screens
- `/dashboard`
- `/transactions`
- `/categories`
- `/fixed-expenses`
- `/budget`
- `/accounts`
- `/settings/security`

## Testing
`npm run test`
