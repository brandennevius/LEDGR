# Mobile App Plan (iOS + Android)

## Goals
- Ship a production mobile app to **Apple App Store** and **Google Play**.
- Reuse the existing **Next.js API backend** and **Supabase auth**.
- Match current web features: dashboard, transactions + splits, goals, accounts, AI chat, categories/groups.

---

## Recommended Approach
**Expo (React Native) + EAS Build**
- Fastest path for iOS + Android with one codebase.
- Mature tooling for auth, deep links, OTA updates.
- Works cleanly with Supabase + existing backend.

---

## Repository Structure (Monorepo)
```
/apps
  /web        (existing Next.js app)
  /mobile     (new Expo app)
/packages
  /shared     (types + shared utilities)
```

---

## Phase 0 — Foundation (1–2 days)
- [ ] Create Expo app in `/apps/mobile` (TypeScript).
- [ ] Add navigation (React Navigation).
- [ ] Add env handling (Expo config + `.env`).
- [ ] Add shared package for types/utilities.
- [ ] Establish API client (base URL, auth headers).

---

## Phase 1 — Auth + Core Shell (2–3 days)
- [ ] Supabase Auth (email/password).
- [ ] OAuth providers: Google + Apple.
- [ ] Auth session handling + secure storage.
- [ ] App shell with bottom tabs + drawer (Dashboard, Transactions, Goals, Accounts, Categories, Settings).
- [ ] Theme system (match current UI: dark gradients + glass).

### Phase 1 Progress (branch: `codex/phase-1-mobile`)
- [x] Supabase Auth (email/password) wired with secure storage.
- [x] OAuth providers: Google + Apple (PKCE via `expo-web-browser`, `expo-auth-session`).
- [x] Auth session handling + secure storage (`expo-secure-store`).
- [x] App shell with bottom tabs + drawer (Dashboard, Transactions, Goals, Accounts, Categories, Settings).
- [x] Theme system (dark gradients + glass panels).

### Implementation Notes (Phase 1)
- App uses `app.config.ts` with scheme `financialcoaching` and `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Supabase client lives in `apps/mobile/src/lib/supabase.ts` with secure storage adapter.
- Auth provider and OAuth handling are in `apps/mobile/src/context/AuthContext.tsx`.
- Root navigator gates between `AuthScreen`, `LoadingScreen`, and `AppNavigator`.
- `react-native-gesture-handler` and `react-native-reanimated` are configured (see `index.ts`, `babel.config.js`).

### After Phase 0 Agent Finishes (merge checklist)
1. Confirm final Expo app location and config from Phase 0.
2. If Phase 0 created `/apps/mobile` already, merge only Phase 1 files and dependencies:
   - `App.tsx`, `index.ts`, `app.config.ts`, `babel.config.js`
   - `src/components`, `src/context`, `src/lib`, `src/navigation`, `src/screens`, `src/theme`
   - Add dependencies: `@react-navigation/*`, `expo-auth-session`, `expo-web-browser`, `expo-secure-store`, `expo-blur`, `expo-linear-gradient`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-safe-area-context`, `react-native-screens`, `@supabase/supabase-js`, `react-native-url-polyfill`
3. Set Supabase env vars and test email/password auth and OAuth flows in a dev build.
4. Verify drawer + tabs render and theme looks consistent with web.

---

## Phase 2 — Dashboard (2–4 days)
- [ ] Dashboard summary cards (spend, income, assets, debt).
- [ ] Monthly spend chart.
- [ ] Top categories panel.
- [ ] Goals summary panel.
- [ ] AI summary snippet.

---

## Phase 3 — Transactions (4–6 days)
- [x] Transaction list (filters + search).
- [x] Transaction detail sheet.
- [x] Category editor.
- [x] **Split transaction** flow.
- [x] Category rules: exact/partial match.
- [x] Similar transaction preview before applying.

**Phase 3 Notes (2026-02-12)**
- Implemented a Transactions tab with mock data, search + type/category filters.
- Added transaction detail sheet with category edit and split actions.
- Built category editor with exact/partial rules and similar-transaction preview.
- Built split transaction flow with split totals + delta validation.

---

## Phase 4 — Goals (3–5 days)
- [ ] Goals list + creation flow.
- [ ] Goal types (Debt, Emergency Fund, Savings, etc.).
- [ ] Goal progress tracking.
- [ ] AI payoff plan + insights.

---

## Phase 5 — Accounts + Plaid (3–5 days)
- [ ] Plaid Link in RN (Plaid RN SDK).
- [ ] Accounts page (connections + sync).
- [ ] Reauth / update flow.
- [ ] Connection status + error banners.

---

## Phase 6 — Categories + Distribution (4–6 days)
- [ ] Categories page (groups + budgets).
- [ ] Category detail with trends.
- [ ] Distribution / Sankey view (mobile-friendly version).

---

## Phase 7 — AI Chat Coach (2–4 days)
- [ ] Floating chat button.
- [ ] Thread UI + streaming responses.
- [ ] Context injection (spend patterns, categories, goals).
- [ ] Query handling for general questions + insights.

---

## Phase 8 — QA + Store Submission (1–2 weeks)
- [ ] App Store / Play Store metadata.
- [ ] Privacy policy + data handling disclosures.
- [ ] Screenshots (device frames, feature highlights).
- [ ] TestFlight + internal testing.
- [ ] Google Play internal + closed testing.
- [ ] Final release.

---

## Dependencies You’ll Need
- **Expo + EAS** account
- **Apple Developer** account ($99/yr)
- **Google Play Console** account ($25 one-time)
- **Plaid React Native SDK** credentials
- **Supabase OAuth redirect URIs** configured for mobile

---

## Milestones
1. **MVP Mobile Shell** (auth + dashboard) — 1 week
2. **Full Feature Parity** (transactions/goals/accounts) — 3–4 weeks
3. **AI + Distribution** — +2 weeks
4. **Store Launch** — +1–2 weeks

---

## Next Step I Recommend
Start Phase 0 + Phase 1 immediately:
- Create Expo app
- Wire Supabase auth
- Build shell/navigation

If you want, I can scaffold `/apps/mobile` and set up auth + navigation first.
