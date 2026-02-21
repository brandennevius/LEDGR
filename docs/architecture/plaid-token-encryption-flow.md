# Plaid Token Encryption Flow

```mermaid
sequenceDiagram
  participant U as "User"
  participant API as "LEDGR API"
  participant P as "Plaid"
  participant E as "Encryption Module"
  participant DB as "Postgres (PlaidItem)"

  U->>API: "POST /api/plaid/exchange (public_token)"
  API->>P: "itemPublicTokenExchange"
  P-->>API: "access_token + item_id"
  API->>E: "encrypt(access_token, aad=item_id)"
  E-->>API: "enc:v1:..."
  API->>DB: "upsert accessToken ciphertext"
  DB-->>API: "stored"
  API-->>U: "linked"
```

```mermaid
sequenceDiagram
  participant Sync as "Sync Route"
  participant DB as "Postgres (PlaidItem)"
  participant E as "Encryption Module"
  participant P as "Plaid"

  Sync->>DB: "load active item rows"
  DB-->>Sync: "item_id + ciphertext"
  Sync->>E: "decrypt(ciphertext, aad=item_id)"
  E-->>Sync: "access_token"
  Sync->>P: "transactionsSync / accountsGet"
  P-->>Sync: "sync result"
  Note over Sync,E: "If token is legacy/plain or on old key, re-encrypt on read"
```

## Rotation Model

- `PLAID_TOKEN_ENCRYPTION_KEYS` supports multiple versioned keys.
- `PLAID_TOKEN_ENCRYPTION_PRIMARY_KEY_ID` selects write key.
- Reads can decrypt with old keys and lazily re-encrypt to primary.
