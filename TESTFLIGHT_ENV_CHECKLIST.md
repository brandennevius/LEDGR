# TestFlight Env Setup Checklist

Goal: keep `dev/preview` and `production` fully separate for both web + mobile, without changing keys during releases.

## What Codex already did

- Updated `/Users/brandennevius/Desktop/Financial Coaching/apps/mobile/eas.json`:
  - `development` -> `channel: development`, `environment: development`
  - `preview` -> `channel: preview`, `environment: preview`
  - `production` -> `channel: production`, `environment: production`

This gives clean OTA/build separation once EAS environments are configured in Expo UI.

## What you do in UIs (required)

## 1) Vercel (Web/API env separation)

- [ ] Open Vercel project settings -> Environment Variables.
- [ ] Add variables to **Development** scope (sandbox/dev values).
- [ ] Add variables to **Preview** scope (sandbox/staging values).
- [ ] Add variables to **Production** scope (live values).
- [ ] Confirm these exist in each scope:
  - `DATABASE_URL`
  - `DIRECT_URL`
  - `NEXT_PUBLIC_APP_URL`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `PLAID_CLIENT_ID`
  - `PLAID_SECRET`
  - `PLAID_ENV`
  - `PLAID_REDIRECT_URI`
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`
- [ ] Redeploy preview + production once after envs are set.

## 2) Expo EAS (Mobile env separation)

- [ ] Open Expo project -> Environments.
- [ ] Create environments:
  - `development`
  - `preview`
  - `production`
- [ ] Add variables per environment:
  - `EXPO_PUBLIC_API_BASE_URL`
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_SUPABASE_REDIRECT_URL=financialcoaching://auth/callback`
  - `EXPO_IOS_BUNDLE_IDENTIFIER` (same bundle id)
  - `EXPO_ANDROID_PACKAGE` (same package id)
- [ ] Set `preview` values to sandbox/test backend.
- [ ] Set `production` values to live backend.

## 3) Supabase + Plaid (keys/source systems)

- [ ] Supabase: confirm project URL + anon key for each environment.
- [ ] Plaid: confirm sandbox creds for dev/preview and production creds for prod.
- [ ] Ensure webhook/redirect URLs match each environment.

## 4) Apple/TestFlight flow

- [ ] Build preview for internal testing:
  - `cd /Users/brandennevius/Desktop/Financial Coaching/apps/mobile`
  - `npx eas build --platform ios --profile preview`
- [ ] Install and test with preview backend.
- [ ] When approved, build production:
  - `npx eas build --platform ios --profile production`
- [ ] Submit production build:
  - `npx eas submit --platform ios --profile production`

## 5) Release process (no key edits required)

- [ ] Merge tested code to `main`.
- [ ] Web auto-deploys with Vercel `Production` vars.
- [ ] Mobile production build uses EAS `production` environment.
- [ ] Do not change env variable names between environments.

## Optional cleanup now

- [ ] Rotate exposed keys if they were pasted/shared in chat or committed to local files.
- [ ] Keep `/Users/brandennevius/Desktop/Financial Coaching/apps/mobile/.env` for local dev only, not as release source of truth.
