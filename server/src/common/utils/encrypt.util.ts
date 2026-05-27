import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHmac,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const CURRENT_VERSION = 'v1';

function getKey(): Buffer {
  const keyBase64 = process.env.ENCRYPTION_KEY;
  if (!keyBase64) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error(`ENCRYPTION_KEY must be 32 bytes (got ${key.length})`);
  }
  return key;
}

export function getKeyForVersion(version: string): Buffer {
  if (!/^v\d+$/.test(version)) {
    throw new Error(`Invalid version format: ${version}`);
  }
  if (version === CURRENT_VERSION) {
    return getKey();
  }
  const envKey = process.env[`ENCRYPTION_KEY_${version.toUpperCase()}`];
  if (envKey) {
    const key = Buffer.from(envKey, 'base64');
    if (key.length !== 32) {
      throw new Error(`Key for ${version} must be 32 bytes`);
    }
    return key;
  }
  throw new Error(`Unknown encryption version: ${version}`);
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Output format: v{version}:{iv_hex}:{authTag_hex}:{ciphertext_hex}
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    CURRENT_VERSION,
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

/**
 * Decrypt ciphertext using AES-256-GCM.
 * Input format: v{version}:{iv_hex}:{authTag_hex}:{ciphertext_hex}
 */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 4) {
    throw new Error(
      'Invalid ciphertext format: expected 4 colon-separated parts',
    );
  }

  const [version, ivHex, authTagHex, encryptedHex] = parts;
  const key = getKeyForVersion(version);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Generate a deterministic HMAC-SHA256 hash for query purposes.
 * Uses PHONE_HASH_SECRET env variable as the key.
 * Used for indexing encrypted fields (e.g. phoneHash for login lookup).
 * HMAC prevents rainbow table attacks since the secret key is required to compute the hash.
 */
export function hashForQuery(input: string): string {
  const secret = process.env.PHONE_HASH_SECRET;
  if (!secret) {
    throw new Error('PHONE_HASH_SECRET environment variable is not set');
  }
  return createHmac('sha256', secret).update(input).digest('hex');
}
