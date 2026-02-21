# LEDGR System Overview

```mermaid
flowchart LR
  User["Web / Mobile User"] --> App["Next.js API (Vercel)"]
  App --> Supabase["Supabase Postgres + Auth"]
  App --> Plaid["Plaid API"]
  App --> OpenAI["OpenAI API"]

  Cron["Vercel Cron"] --> App
  Webhook["Plaid Webhook"] --> App

  App --> Enc["App-Layer Token Encryption (AES-GCM)"]
  Enc --> Supabase
```

## Notes

- The API runtime on Vercel is the trust boundary that handles encryption/decryption.
- Supabase stores encrypted Plaid token ciphertext for active linked items.
- Plaid webhooks and scheduled cron both feed transaction sync.
