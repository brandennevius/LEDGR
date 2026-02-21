import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ENVELOPE_PREFIX = "enc";
const ENVELOPE_VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_SIZE_BYTES = 12;
const AUTH_TAG_SIZE_BYTES = 16;
const KEY_SIZE_BYTES = 32;

type EncryptionKey = {
  id: string;
  key: Buffer;
};

type Keyring = {
  primaryKeyId: string;
  keys: EncryptionKey[];
  keysById: Map<string, Buffer>;
};

export type SecretDecryptResult = {
  plaintext: string;
  wasEncrypted: boolean;
  keyId: string | null;
  requiresReencryption: boolean;
};

let keyringCache: Keyring | null | undefined;

const parseKeyringFromEnv = (): Keyring | null => {
  const rawKeys = process.env.PLAID_TOKEN_ENCRYPTION_KEYS?.trim();
  if (!rawKeys) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "PLAID_TOKEN_ENCRYPTION_KEYS must be configured in production."
      );
    }
    return null;
  }

  const keys = rawKeys
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const splitIndex = entry.indexOf(":");
      if (splitIndex <= 0 || splitIndex === entry.length - 1) {
        throw new Error(
          "Invalid PLAID_TOKEN_ENCRYPTION_KEYS format. Use 'keyId:base64Key,keyId2:base64Key2'."
        );
      }

      const id = entry.slice(0, splitIndex).trim();
      const base64Key = entry.slice(splitIndex + 1).trim();
      const key = Buffer.from(base64Key, "base64");

      if (key.length !== KEY_SIZE_BYTES) {
        throw new Error(
          `Invalid encryption key length for '${id}'. Expected ${KEY_SIZE_BYTES} bytes (base64).`
        );
      }

      return { id, key };
    });

  if (keys.length === 0) {
    throw new Error("PLAID_TOKEN_ENCRYPTION_KEYS must include at least one key.");
  }

  const keysById = new Map<string, Buffer>();
  for (const keyEntry of keys) {
    if (keysById.has(keyEntry.id)) {
      throw new Error(`Duplicate encryption key id '${keyEntry.id}'.`);
    }
    keysById.set(keyEntry.id, keyEntry.key);
  }

  const configuredPrimary =
    process.env.PLAID_TOKEN_ENCRYPTION_PRIMARY_KEY_ID?.trim();
  const primaryKeyId = configuredPrimary || keys[0].id;
  if (!keysById.has(primaryKeyId)) {
    throw new Error(
      `PLAID_TOKEN_ENCRYPTION_PRIMARY_KEY_ID '${primaryKeyId}' was not found in PLAID_TOKEN_ENCRYPTION_KEYS.`
    );
  }

  return {
    primaryKeyId,
    keys,
    keysById,
  };
};

const getKeyring = (): Keyring | null => {
  if (keyringCache !== undefined) return keyringCache;
  keyringCache = parseKeyringFromEnv();
  return keyringCache;
};

const parseEnvelope = (value: string) => {
  if (!value.startsWith(`${ENVELOPE_PREFIX}:`)) {
    return null;
  }

  const parts = value.split(":");
  if (parts.length !== 6) {
    throw new Error("Malformed encrypted secret envelope.");
  }

  const [, version, keyId, ivEncoded, authTagEncoded, ciphertextEncoded] = parts;
  if (!version || !keyId || !ivEncoded || !authTagEncoded || !ciphertextEncoded) {
    throw new Error("Malformed encrypted secret envelope.");
  }

  const iv = Buffer.from(ivEncoded, "base64url");
  const authTag = Buffer.from(authTagEncoded, "base64url");
  const ciphertext = Buffer.from(ciphertextEncoded, "base64url");

  if (iv.length !== IV_SIZE_BYTES || authTag.length !== AUTH_TAG_SIZE_BYTES) {
    throw new Error("Malformed encrypted secret payload.");
  }

  return {
    version,
    keyId,
    iv,
    authTag,
    ciphertext,
  };
};

export const encryptSecret = (plaintext: string, aadContext: string): string => {
  const keyring = getKeyring();
  if (!keyring) {
    throw new Error(
      "Encryption keys are not configured. Set PLAID_TOKEN_ENCRYPTION_KEYS."
    );
  }

  const primaryKey = keyring.keysById.get(keyring.primaryKeyId);
  if (!primaryKey) {
    throw new Error("Primary encryption key is unavailable.");
  }

  const iv = randomBytes(IV_SIZE_BYTES);
  const cipher = createCipheriv(ALGORITHM, primaryKey, iv);
  cipher.setAAD(Buffer.from(aadContext, "utf8"));

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENVELOPE_PREFIX,
    ENVELOPE_VERSION,
    keyring.primaryKeyId,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
};

const decryptWithKey = (
  key: Buffer,
  aadContext: string,
  payload: {
    iv: Buffer;
    authTag: Buffer;
    ciphertext: Buffer;
  }
) => {
  const decipher = createDecipheriv(ALGORITHM, key, payload.iv);
  decipher.setAAD(Buffer.from(aadContext, "utf8"));
  decipher.setAuthTag(payload.authTag);
  const plaintextBuffer = Buffer.concat([
    decipher.update(payload.ciphertext),
    decipher.final(),
  ]);
  return plaintextBuffer.toString("utf8");
};

export const decryptSecret = (storedValue: string, aadContext: string): SecretDecryptResult => {
  const parsed = parseEnvelope(storedValue);
  const keyring = getKeyring();

  if (!parsed) {
    return {
      plaintext: storedValue,
      wasEncrypted: false,
      keyId: null,
      requiresReencryption: Boolean(keyring),
    };
  }

  if (!keyring) {
    throw new Error(
      "Encrypted secret found but encryption keys are not configured."
    );
  }

  const candidates: EncryptionKey[] = [];
  const preferred = keyring.keysById.get(parsed.keyId);
  if (preferred) {
    candidates.push({ id: parsed.keyId, key: preferred });
  }
  for (const keyEntry of keyring.keys) {
    if (keyEntry.id === parsed.keyId) continue;
    candidates.push(keyEntry);
  }

  for (const candidate of candidates) {
    try {
      const plaintext = decryptWithKey(candidate.key, aadContext, parsed);
      return {
        plaintext,
        wasEncrypted: true,
        keyId: candidate.id,
        requiresReencryption:
          parsed.version !== ENVELOPE_VERSION ||
          candidate.id !== keyring.primaryKeyId,
      };
    } catch {
      continue;
    }
  }

  throw new Error("Failed to decrypt secret with configured keys.");
};
