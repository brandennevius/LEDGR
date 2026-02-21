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

