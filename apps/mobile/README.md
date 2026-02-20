# LEDGR Mobile (Expo)

This app is built for production-style native OAuth (Google/Apple) with Supabase.

## 1) Environment Sets

Use separate local env files:

- `apps/mobile/.env.development.local` for local/dev testing
- `apps/mobile/.env.production.local` for local production-like testing

Start from examples:

```bash
cp apps/mobile/.env.development.example apps/mobile/.env.development.local
cp apps/mobile/.env.production.example apps/mobile/.env.production.local
```

Development example values:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_SUPABASE_URL=https://trntedlwuzzhentpoimx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<dev-anon-key>
EXPO_PUBLIC_SUPABASE_REDIRECT_URL=financialcoaching://auth/callback

EXPO_IOS_BUNDLE_IDENTIFIER=com.brandennevius.ledgr
EXPO_ANDROID_PACKAGE=com.brandennevius.ledgr
```

Production example values:

```bash
EXPO_PUBLIC_API_BASE_URL=https://ledgr-henna.vercel.app
EXPO_PUBLIC_SUPABASE_URL=https://vzqglynuamhjgrghbgqn.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<prod-anon-key>
EXPO_PUBLIC_SUPABASE_REDIRECT_URL=financialcoaching://auth/callback
```

## 2) Supabase Auth configuration

In Supabase Dashboard:

- **Authentication → URL Configuration**
  - Site URL: `https://ledgr-henna.vercel.app`
  - Redirect URLs must include:
    - `financialcoaching://auth/callback`

- **Authentication → Providers → Google**
  - Enabled
  - Client ID / Secret from Google Cloud

## 3) Google Cloud OAuth configuration

Create an OAuth **Web application** client and set:

- Authorized redirect URI:
  - `https://<your-project-ref>.supabase.co/auth/v1/callback`

No custom mobile URI is needed in Google Cloud for Supabase-hosted OAuth.

## 4) Run locally (dev or production-like)

Use a dev build (**not Expo Go**):

```bash
cd apps/mobile
npm run run:ios:dev
# or
npm run run:android:dev
```

Then start Metro:

```bash
npm run start:dev
```

To run with production local env files:

```bash
npm run run:ios:prod
npm run start:prod
```

The app intentionally blocks OAuth in Expo Go to avoid non-production redirect behavior.

## 5) EAS builds (App Store / Play)

```bash
cd apps/mobile
npx eas login
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
```

Optional internal QA build:

```bash
npx eas build --platform ios --profile preview
npx eas build --platform android --profile preview
```

EAS profiles use EAS environment sets (not local files):

- `preview` / `development`: dev keys
- `production`: production keys

## OAuth troubleshooting

- If login opens web and lands on Site URL, redirect allow-list is missing/mismatched.
- Confirm app uses `financialcoaching://auth/callback`.
- Confirm Supabase redirect list includes that exact value.
- Rebuild dev client after identifier/scheme changes.
