# Financial Coaching POC

Client-first financial coaching app with Plaid-powered data, goals, trends, and AI insights. Built to explore a Copilot‑style UX with coach‑grade analytics.

## What’s inside
- Auth via Supabase (email/password + OAuth)
- Plaid account linking + transactions sync
- Client dashboard (spend, income, categories, goals)
- Transactions workspace with side‑panel detail + recategorization
- Goals + AI payoff insights
- In‑app AI chat for personalized insights
- Prisma + Postgres (Supabase)
- Dark / light theme toggle

## Tech stack
- Next.js App Router (TypeScript)
- Prisma + PostgreSQL (Supabase)
- Plaid
- OpenAI
- Tailwind CSS

## Getting started

### 1) Install deps
```bash
npm install
```

### 2) Environment
Create `.env.local`:
```bash
DATABASE_URL=""
DIRECT_URL=""
NEXT_PUBLIC_APP_URL="http://localhost:3000"

NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""

PLAID_CLIENT_ID=""
PLAID_SECRET=""
PLAID_ENV="sandbox"
PLAID_REDIRECT_URI=""

OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o-mini"
```

### 3) Prisma
```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4) Run
```bash
npm run dev
```
Open http://localhost:3000

## Scripts
- `npm run dev` — local dev
- `npm run prisma:generate` — Prisma client
- `npm run prisma:migrate` — DB migrations

## Notes
- Plaid sandbox is supported for testing.
- AI chat uses OpenAI; be mindful of PII handling.

## Deployment
Recommended: Vercel Git integration. Push to main and let Vercel build.

## Status
Active POC under rapid iteration.
Deployment test: README update.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
