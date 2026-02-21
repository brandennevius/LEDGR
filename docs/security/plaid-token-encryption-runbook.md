# Plaid Token Encryption Runbook

- Owner: Branden Nevius
- Last reviewed: 2026-02-21
- Scope: Encryption key management for `PlaidItem.accessToken` secrets

## 1) Purpose

This runbook defines how LEDGR generates, stores, rotates, and verifies application-layer encryption keys used for Plaid access tokens.

## 2) Where Keys Must Live

Production keys must be stored in the runtime secret manager for the service that executes API routes.

For current architecture:

- Web/API runtime: Vercel
- Required location for production keys: Vercel Project Environment Variables
- Local development only: `.env.local`

Do not store encryption keys in:

- Git
- Source files
- Supabase database tables
- Client/mobile app configuration

## 3) Required Environment Variables

- `PLAID_TOKEN_ENCRYPTION_KEYS`
- `PLAID_TOKEN_ENCRYPTION_PRIMARY_KEY_ID`

Format:

- `PLAID_TOKEN_ENCRYPTION_KEYS="v1:<base64-32-byte-key>,v2:<base64-32-byte-key>"`
- `PLAID_TOKEN_ENCRYPTION_PRIMARY_KEY_ID="v2"`

Notes:

- Key IDs (`v1`, `v2`, etc.) are labels.
- Each key value must decode to exactly 32 bytes.
- In production, missing keys should fail closed.

## 4) Generate a New Key

```bash
openssl rand -base64 32
```

Record the new key in the secured secret manager, not in plaintext docs.

## 5) Standard Rotation Cadence

- Rotate every 90 days.
- Also rotate immediately on incident triggers:
  - suspected key exposure
  - leaked secret in logs or CI
  - unauthorized admin access

Reference schedule:

- If rotated on 2026-02-21, next routine rotation due 2026-05-22.

## 6) Planned Rotation Procedure

1. Generate a new key (`v{N+1}`).
2. In Vercel Production env, set:
   - `PLAID_TOKEN_ENCRYPTION_KEYS` to include old and new keys
   - `PLAID_TOKEN_ENCRYPTION_PRIMARY_KEY_ID` to the new key ID
3. Deploy.
4. Verify app health:
   - Plaid link (exchange)
   - account sync
   - transaction sync
   - webhook processing
5. Monitor migration progress (lazy re-encryption on read):

```sql
SELECT COUNT(*) AS not_on_primary
FROM "PlaidItem"
WHERE "accessToken" NOT LIKE 'enc:v2:%';
```

6. When `not_on_primary = 0`, remove old keys from `PLAID_TOKEN_ENCRYPTION_KEYS`.
7. Deploy again.
8. Record completion date, actor, and key IDs in security evidence log.

## 7) Emergency Rotation Procedure (Suspected Compromise)

1. Generate a new key immediately.
2. Update Vercel env:
   - Add new key and make it primary.
3. Deploy immediately.
4. Evaluate blast radius:
   - Which environments were affected
   - Which logs/systems may have exposed keys
5. If compromise likely involved plaintext access token exposure:
   - Rotate affected Plaid credentials
   - Force user relink where required
6. Complete incident timeline and corrective actions per incident procedure.

## 8) Verification and Health Checks

### Encryption envelope coverage

```sql
SELECT
  COUNT(*) FILTER (WHERE "accessToken" LIKE 'enc:%') AS encrypted_rows,
  COUNT(*) FILTER (WHERE "accessToken" NOT LIKE 'enc:%') AS plaintext_rows
FROM "PlaidItem";
```

### Primary key adoption

```sql
SELECT COUNT(*) AS primary_rows
FROM "PlaidItem"
WHERE "accessToken" LIKE 'enc:v2:%';
```

### Functional smoke tests

- Link a new sandbox institution.
- Trigger `/api/plaid/accounts/sync`.
- Trigger `/api/plaid/transactions/sync`.
- Confirm no 5xx responses in Vercel logs for Plaid routes.

## 9) Rollback

If deployment fails after switching primary:

1. Revert `PLAID_TOKEN_ENCRYPTION_PRIMARY_KEY_ID` to prior key ID.
2. Keep both keys in `PLAID_TOKEN_ENCRYPTION_KEYS`.
3. Redeploy.

Do not remove old key until data migration is verified complete.

## 10) Responsibilities and Evidence

Minimum evidence to retain per rotation:

- Rotation date/time (UTC)
- Engineer performing change
- Old/new primary key IDs (IDs only, never key values)
- Deployment reference
- Verification query output snapshots
- Any incidents or anomalies

## 11) Architecture Clarification: Vercel vs Supabase

Use Vercel env vars because the encryption/decryption code runs in Next.js API routes hosted on Vercel.

Supabase is the database in this path, not the runtime executing encryption logic. Supabase should store encrypted token ciphertext, not encryption keys.
