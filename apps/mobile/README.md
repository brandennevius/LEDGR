# LEDGR Mobile (Expo)

This app is built for production-style native OAuth (Google/Apple) with Supabase.

## 1) Environment

Create `apps/mobile/.env`:

```bash
EXPO_PUBLIC_API_BASE_URL=https://ledgr-henna.vercel.app
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
EXPO_PUBLIC_SUPABASE_REDIRECT_URL=financialcoaching://auth/callback

EXPO_IOS_BUNDLE_IDENTIFIER=com.brandennevius.ledgr
EXPO_ANDROID_PACKAGE=com.brandennevius.ledgr
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

## 4) Run locally (production-like)

Use a dev build (**not Expo Go**):

```bash
cd apps/mobile
npx expo run:ios
# or
npx expo run:android
```

Then start Metro:

```bash
npx expo start --dev-client
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

## OAuth troubleshooting

- If login opens web and lands on Site URL, redirect allow-list is missing/mismatched.
- Confirm app uses `financialcoaching://auth/callback`.
- Confirm Supabase redirect list includes that exact value.
- Rebuild dev client after identifier/scheme changes.
