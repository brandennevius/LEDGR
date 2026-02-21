# LEDGR Product Ideas Tracker

## Security Baseline Review (Current State)

1. Platform encryption (at rest + TLS): **Yes**
2. App-level encryption for high-risk secrets: **No**
3. Key management (KMS/HSM/Vault + rotation): **Partial**
4. Strict access boundaries + auditing: **Partial**
5. Token minimization / isolated secrets service: **No**

---

## Transaction Sync Freshness (Current Behavior + Upgrade Plan)

### Status
- **Completed** on `main` (webhook-driven sync + scheduled fallback)

### Implemented
- Plaid webhook now triggers transaction sync on transaction update webhooks.
- Added webhook sync throttling to prevent sync storms.
- Added scheduled fallback endpoint:
  - `GET/POST /api/plaid/transactions/cron`
  - Auth via `CRON_SECRET` (or local non-prod fallback when unset)
- Added Vercel cron schedule every 2 hours:
  - `0 */2 * * *` -> `/api/plaid/transactions/cron`
- Refactored sync pipeline into shared service:
  - `/src/lib/plaidTransactionsSync.ts`

### Notes
- This improves freshness but still depends on bank posting latency and Plaid availability.
- Next optional UX step: display “Last synced” timestamp in app.

---

## Auth + Legal Flow Revamp

### Status
- **Completed** on `main`

### Implemented
- Reworked mobile auth UX into explicit `Log in` and `Create account` modes.
- Signup now requires:
  - password confirmation
  - terms acceptance checkbox
  - privacy acceptance checkbox
- Signup verification email now redirects to app login deep link with verified notice.
- Removed verbose OAuth debug logging from mobile auth flow.
- Added policy acceptance backend:
  - `GET /api/policies/status`
  - `POST /api/policies/accept`
- Added policy acceptance gate after authentication in app.
- Added versioned policy constants for Terms and Privacy.

### Remaining Optional Enhancements
- Show policy version and acceptance timestamp in Settings.
- Add forced re-consent UX when policy version changes with changelog summary.

---

## Account Deletion (Settings)

### Requested
- Add a **Delete account** button in Settings.
- On confirm, fully wipe user account data.

### Required Deletion Scope
- User profile
- Plaid items and linked accounts
- Transactions and splits
- Categories, rules, groups
- Goals and reviews
- Chat threads/messages

### Implementation Notes
- Require strong confirmation step (type `DELETE` or similar).
- Require recent auth re-check before destructive delete.
- Perform deletion server-side in a transaction.
- Return user to logged-out state after completion.
