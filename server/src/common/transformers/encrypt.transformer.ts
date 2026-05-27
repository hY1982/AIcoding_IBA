import { ValueTransformer } from 'typeorm';
import { encrypt, decrypt } from '@common/utils/encrypt.util';

function assertString(
  value: unknown,
  direction: 'encrypt' | 'decrypt',
): string | null | undefined {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value !== 'string') {
    throw new TypeError(
      `EncryptTransformer expected string for ${direction}, got ${typeof value}`,
    );
  }
  return value;
}

/**
 * TypeORM ValueTransformer for AES-256-GCM encryption/decryption.
 * Automatically encrypts values before saving to the database
 * and decrypts them when reading from the database.
 */
export const EncryptTransformer: ValueTransformer = {
  to(value: unknown): string | null | undefined {
    const str = assertString(value, 'encrypt');
    if (str === null || str === undefined) {
      return str;
    }
    return encrypt(str);
  },

  from(value: unknown): string | null | undefined {
    const str = assertString(value, 'decrypt');
    if (str === null || str === undefined) {
      return str;
    }
    try {
      return decrypt(str);
    } catch (err) {
      throw new Error(
        `Failed to decrypt field value: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }
  },
};
