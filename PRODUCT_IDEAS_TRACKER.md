# LEDGR Product Ideas Tracker

## Security Baseline Review (Current State)

### Benchmark Areas and LEDGR Status
1. Platform encryption (at rest + TLS): **Yes**
- Supabase/Vercel baseline protections are in place.

2. App-level encryption for high-risk secrets: **Yes**
- Plaid access tokens are encrypted at application layer (AES-256-GCM envelope).
- Active Plaid items are encrypted in production.

3. Key management (KMS/HSM/Vault + rotation): **Partial**
- Rotation lifecycle is now documented and implemented via versioned env keys.
- Next maturity step is moving key material to managed KMS/HSM.

4. Strict access boundaries + auditing: **Partial**
- Good user-scoped API auth is implemented.
- Needs stronger privileged-access auditing and cleanup of sensitive debug logs.

5. Token minimization / isolated secrets service: **No**
- Tokens are persisted in the main application data model.

### Immediate Security Priorities
1. Encrypt Plaid access tokens at application layer (AES-GCM + key management). **Completed**
2. Remove/redact OAuth debug logs from mobile auth flow. **Completed**
3. Tighten production DB access and privileged audit logging. **Open**
4. Enforce production-safe webhook verification and auth hardening checks. **In progress**

### Current Rollout Snapshot
- Cron sync is running with `CRON_SECRET` auth and per-item failure isolation.
- Active Plaid items in production are encrypted.
- Security runbook added at `/Users/brandennevius/Desktop/LEDGR/docs/security/plaid-token-encryption-runbook.md`.

---

## Transaction Sync Freshness (Current Behavior + Upgrade Plan)

### Status
- **Completed** on `main` (webhook-driven sync + scheduled fallback)

### Current Behavior (Now)
- New transactions sync from:
  - Plaid transaction webhooks (primary path)
  - App-triggered syncs (`Sync now`, post-link/relink)
  - Scheduled cron fallback every 2 hours

### User Impact
- Posted transaction visibility is faster and more reliable than manual-trigger-only behavior.
- Timing depends on:
  1. bank posting latency
  2. Plaid availability of the posted transaction
  3. webhook delivery and retry timing

### Implemented
- Plaid webhook triggers transaction sync for relevant transaction update events.
- Webhook sync throttling to reduce sync storms.
- Scheduled fallback endpoint:
  - `GET/POST /api/plaid/transactions/cron`
  - Auth via `CRON_SECRET`
- Vercel cron every 2 hours:
  - `0 */2 * * *` -> `/api/plaid/transactions/cron`
- Shared sync service:
  - `/src/lib/plaidTransactionsSync.ts`

### Next Optional UX
- Show `Last synced` timestamp in app.
- Add lightweight “new transactions available” state.

---

## Idea 1: Per-User Learning for Transaction Classification

### Goal
Reduce manual recategorization by learning each user's behavior over time.

### Current State
- User-scoped rules already exist (`EXACT` / `PARTIAL`).
- Sync pipeline already applies rules on future transactions.
- Manual edits already capture user intent, but are not yet used as a continuous learning signal.

### Proposed Implementation
1. Feedback memory
- Persist each user correction as a labeled training event.
- Capture: normalized merchant, amount bucket, account type/subtype, date context, prior label, final label.

2. Rule synthesis
- Auto-create or strengthen a rule after repeated consistent corrections.
- Keep user-visible override + delete controls.

3. Per-user scorer
- Add lightweight confidence scoring per user (start simple: weighted historical matching).
- Confidence bands:
  - High: auto-apply
  - Medium: prefill + mark needs review
  - Low: leave unchanged

4. Safety controls
- Never auto-assign internal transfers unless strict transfer checks pass.
- Full audit trail and one-tap undo for auto-applied changes.

5. Monitoring
- Track precision, override/undo rate, and category drift by user.

### Delivery Plan
- Phase 1 (2-4 days): Feedback memory + merchant normalization + auto rule creation from repeated edits.
- Phase 2 (3-5 days): Per-user confidence scorer + threshold-based auto-apply.
- Phase 3 (2-3 days): Monitoring, tuning, rollback/guardrails.

### Effort
- MVP: 2-4 days
- Production-grade: ~1-2 weeks

### Acceptance Criteria
- Fewer manual category edits per week per active user.
- Lower "needs review" count over time without increased correction rate.
- No increase in incorrect internal transfer assignment.

---

## Idea 2: Transaction Filters + Power Query Search

### Goal
Make transactions filtering complete, fast, and consistent with user intent.

### Requested Scope
- Add `Internal transfers` to filter by type.
- Expand date filters:
  - Keep rolling windows (`7d`, `14d`, `30d`, `90d`, add `180d`)
  - Add month picker (single month, e.g. June 2026)
  - Add year picker (single year)
- Add `Needs review` filter.
- Add `Filter by account`.
- Improve “Filter by month” naming so it matches actual behavior.

### Natural-Language Search (Preset + Freeform)
- Search bar supports prompt-style queries:
  - “only show Amazon transactions”
  - “unreviewed transactions above $100”
  - “show food purchases from June”
  - “what’s my net income for June”
- Preset suggestion chips in the search dropdown.
- Query parses into structured filters + optional computed answer (for metric questions).

### Delivery Plan
- Phase 1: filter model/UI cleanup + backend query params parity.
- Phase 2: month/year pickers + account/type/review filters.
- Phase 3: NLP parser + preset prompts + metric-answer mode.

---

## Idea 3: AI-Native Goals (Penny -> Goal Creation + Tracking)

### Goal
Allow users to chat with Penny to plan and launch real goals (starting with emergency fund).

### Requested Scope
- Penny can propose emergency fund goal using spend baseline:
  - Target = 3-6 months of average essential spend
  - Suggested monthly contribution
  - ETA forecast
- User can approve in chat and Penny creates the goal in Goals.
- Ongoing progress tracking:
  - Preferred: link one or more accounts to goal
  - Fallback/manual: user logs monthly contribution
  - Optional: tag transactions as goal contributions

### Goal Analytics UX
- Goal chart: `Savings on Y-axis`, `Time on X-axis`
- Two lines:
  - Forecasted path
  - Actual progress
- Show variance (ahead/behind plan) and updated ETA.

### Delivery Plan
- Phase 1: goal-plan payload in chat + confirm/create action.
- Phase 2: contribution attribution (linked accounts + manual entry).
- Phase 3: forecast vs actual chart + variance explanations.

---

## Idea 4: Wealth Page (Assets, Liabilities, Net Worth)

### Goal
Add a dedicated wealth view that summarizes holdings, debt, and net worth trend.

### Requested Scope
- Assets section:
  - Group by type (cash, equities, retirement, crypto, other)
  - Pie/donut chart with percentages and values
- Liabilities section:
  - Group by type (credit cards, personal loans, mortgage, student loans, other)
  - Breakdown chart + totals
- Net worth section:
  - Total assets - total liabilities
  - Historical trend

### Recommended Net Worth Visualization
- Primary chart: **line chart over time** (weekly/month-end points)
  - Best for direction and momentum
- Secondary context:
  - stacked area or stacked bars by asset/liability components
  - optional “change drivers” list for biggest monthly moves

### Delivery Plan
- Phase 1: backend aggregates + account-type mapping.
- Phase 2: assets/liabilities composition charts.
- Phase 3: net worth trend + drivers and period filters.

---

## Prioritization Queue
1. Idea 2: Transaction Filters + Power Query Search
2. Idea 3: AI-Native Goals
3. Idea 4: Wealth Page

---

## Auth + Legal Flow Revamp

### Status
- **Completed** on `main`

### Implemented
- Reworked mobile auth flow into explicit `Log in` and `Create account` modes.
- Signup requires:
  - password confirmation
  - terms acceptance
  - privacy acceptance
- Added policy acceptance gate after auth:
  - `GET /api/policies/status`
  - `POST /api/policies/accept`
- Added `PolicyAcceptance` DB model + migration.
- Embedded Terms and Privacy directly inside mobile app (no browser redirect) from:
  - Auth screen
  - Policy gate screen
  - Settings > About
- Rewrote web Terms and Privacy pages with more detailed, product-accurate language.

---

## Account Deletion (Settings)

### Requested
- Add a **Delete account** button in Settings.
- On confirm, wipe account data and sign user out.

### Required Deletion Scope
- User profile
- Plaid items and linked accounts
- Transactions and splits
- Categories, rules, groups
- Goals and reviews
- Chat threads/messages

### Implementation Notes
- Require strong confirmation step (type `DELETE`).
- Require recent-auth re-check.
- Perform deletion server-side in one transaction.
- Audit log the delete event.
