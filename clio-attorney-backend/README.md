# Clio Attorney Backend (Vercel)

Backend API hosted on Vercel to authorize with Clio and compute attorney metrics (working, originating, referral).

## Setup

1. Copy env template:
   cp .env.example .env.local

2. Fill the following values:
   - CLIO_CLIENT_ID, CLIO_CLIENT_SECRET, CLIO_REDIRECT_URI
   - CLIO_BASE_URL (default US: https://app.clio.com)
   - KV_* (from Vercel KV / Upstash)
a
3. Install deps:
   npm install

4. Run locally (requires Vercel CLI):
   npx vercel dev -d

## OAuth URLs

- Start: /api/oauth/start?firmId=YOUR_FIRM_ID
- Callback: Set CLIO_REDIRECT_URI to your deployed callback URL (e.g. https://your-app.vercel.app/api/oauth/callback)

## Cron

A daily sync runs at 03:00 UTC hitting /api/sync. You can change the schedule in `vercel.json`.

## Metrics and Export

- Compute placeholder metrics: `GET /api/sync?firmId=...`
- Download combined Excel (one sheet per originating attorney):
  - `GET /api/export?firmId=...` -> returns `metrics-FIRM.xlsx`
- Download single-attorney Excel:
  - `GET /api/export/attorney?firmId=...&attorneyId=...`

When you provide the algorithms, we will replace the placeholders in `api/sync.ts` and feed real values into the Excel builder in `lib/excel.ts`.
