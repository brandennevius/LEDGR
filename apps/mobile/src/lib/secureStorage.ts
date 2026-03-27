import * as SecureStore from 'expo-secure-store';

const SECURE_STORE_CHUNK_SIZE = 1800;

const buildChunkKey = (key: string, index: number) => `${key}__chunk__${index}`;
const buildChunkCountKey = (key: string) => `${key}__chunk_count`;

async function removeChunkedValue(key: string) {
  const countRaw = await SecureStore.getItemAsync(buildChunkCountKey(key));
  const count = Number(countRaw ?? '0');

  if (Number.isFinite(count) && count > 0) {
    await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.deleteItemAsync(buildChunkKey(key, index))
      )
    );
  }

  await SecureStore.deleteItemAsync(buildChunkCountKey(key));
}

export async function getSecureJsonString(key: string) {
  const directValue = await SecureStore.getItemAsync(key);
  if (directValue !== null) return directValue;

  const countRaw = await SecureStore.getItemAsync(buildChunkCountKey(key));
  const count = Number(countRaw ?? '0');
  if (!Number.isFinite(count) || count <= 0) return null;

  const chunks = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      SecureStore.getItemAsync(buildChunkKey(key, index))
    )
  );

  if (chunks.some((chunk) => chunk === null)) {
    await removeChunkedValue(key);
    return null;
  }

  return chunks.join('');
}

export async function setSecureJsonString(key: string, value: string) {
  await SecureStore.deleteItemAsync(key);
  await removeChunkedValue(key);

  if (value.length <= SECURE_STORE_CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value);
    return;
  }

  const chunks = value.match(new RegExp(`.{1,${SECURE_STORE_CHUNK_SIZE}}`, 'g')) ?? [];

  await Promise.all(
    chunks.map((chunk, index) => SecureStore.setItemAsync(buildChunkKey(key, index), chunk))
  );
  await SecureStore.setItemAsync(buildChunkCountKey(key), String(chunks.length));
}

export async function removeSecureJsonString(key: string) {
  await SecureStore.deleteItemAsync(key);
  await removeChunkedValue(key);
}

