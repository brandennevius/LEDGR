import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/secretEncryption";

type PlaidItemWithEncryptedToken = {
  id: string;
  itemId: string;
  accessTokenEncrypted: string;
};

const accessTokenAad = (itemId: string) => `plaid:item:${itemId}:access_token`;

export const encryptPlaidAccessToken = (
  itemId: string,
  accessToken: string
) => encryptSecret(accessToken, accessTokenAad(itemId));

export const getPlaidAccessToken = async (
  item: PlaidItemWithEncryptedToken
) => {
  const decrypted = decryptSecret(
    item.accessTokenEncrypted,
    accessTokenAad(item.itemId)
  );

  if (decrypted.requiresReencryption) {
    const rotatedCiphertext = encryptPlaidAccessToken(item.itemId, decrypted.plaintext);
    await prisma.plaidItem.update({
      where: { id: item.id },
      data: { accessTokenEncrypted: rotatedCiphertext },
    });
  }

  return decrypted.plaintext;
};

export const hydratePlaidItemsWithAccessTokens = async <
  T extends PlaidItemWithEncryptedToken
>(
  items: T[]
): Promise<Array<T & { accessToken: string }>> =>
  Promise.all(
    items.map(async (item) => ({
      ...item,
      accessToken: await getPlaidAccessToken(item),
    }))
  );
