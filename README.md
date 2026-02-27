# Personal Finance Dashboard MVP

A Next.js + Postgres dashboard focused on spending clarity for Israeli bank and credit-card accounts.

## Stack
- Next.js (App Router, TypeScript)
- Prisma + Postgres
- NextAuth (Google OAuth)
- AES-256-GCM app-layer encryption for sensitive fields

## Quick Start
1. Install dependencies:
   `npm install`
2. Copy env template:
   `cp .env.example .env`
3. Generate Prisma client:
   `npx prisma generate`
4. Run migrations:
   `npx prisma migrate dev --name init`
5. Seed categories:
   `npx prisma db seed`
6. Start app:
   `npm run dev`

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
- For local development without live bank credentials, fallback mock sync data is generated.

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
