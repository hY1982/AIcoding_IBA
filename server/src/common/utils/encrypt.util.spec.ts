import {
  encrypt,
  decrypt,
  getKeyForVersion,
  hashForQuery,
} from './encrypt.util';

describe('encrypt.util', () => {
  const originalKey = process.env.ENCRYPTION_KEY;
  const originalPhoneSecret = process.env.PHONE_HASH_SECRET;

  beforeAll(() => {
    // 32-byte base64 key for testing (generated via openssl rand -base64 32)
    process.env.ENCRYPTION_KEY = 'vXloZBGTT7syeDNs5GBducYtkWxMuWifda6JljWUfHA=';
    process.env.PHONE_HASH_SECRET = 'test-phone-hash-secret-key-32bytes';
  });

  afterAll(() => {
    process.env.ENCRYPTION_KEY = originalKey;
    process.env.PHONE_HASH_SECRET = originalPhoneSecret;
  });

  describe('encrypt / decrypt', () => {
    it('should encrypt and decrypt a simple string', () => {
      const plaintext = '13800138000';
      const ciphertext = encrypt(plaintext);
      expect(ciphertext).not.toBe(plaintext);
      expect(ciphertext).toContain(':');
      expect(ciphertext.startsWith('v1:')).toBe(true);

      const decrypted = decrypt(ciphertext);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for same plaintext (random IV)', () => {
      const plaintext = 'same-text';
      const c1 = encrypt(plaintext);
      const c2 = encrypt(plaintext);
      expect(c1).not.toBe(c2);
      expect(decrypt(c1)).toBe(plaintext);
      expect(decrypt(c2)).toBe(plaintext);
    });

    it('should handle empty string', () => {
      const ciphertext = encrypt('');
      expect(decrypt(ciphertext)).toBe('');
    });

    it('should handle unicode characters', () => {
      const plaintext = '张三李四🎉';
      const ciphertext = encrypt(plaintext);
      expect(decrypt(ciphertext)).toBe(plaintext);
    });

    it('should handle long text', () => {
      const plaintext = 'a'.repeat(10000);
      const ciphertext = encrypt(plaintext);
      expect(decrypt(ciphertext)).toBe(plaintext);
    });

    it('should throw on tampered ciphertext', () => {
      const plaintext = 'sensitive-data';
      const ciphertext = encrypt(plaintext);
      const tampered = ciphertext.slice(0, -5) + 'xxxxx';
      expect(() => decrypt(tampered)).toThrow();
    });

    it('should throw on invalid version prefix', () => {
      expect(() => decrypt('invalid')).toThrow();
    });

    it('should throw when ENCRYPTION_KEY is missing', () => {
      const saved = process.env.ENCRYPTION_KEY;
      delete (process.env as Record<string, string>).ENCRYPTION_KEY;
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY');
      process.env.ENCRYPTION_KEY = saved;
    });
  });

  describe('getKeyForVersion', () => {
    it('should return current key for v1', () => {
      const key = getKeyForVersion('v1');
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should throw for unknown version', () => {
      expect(() => getKeyForVersion('v99')).toThrow();
    });

    it('should throw for invalid version format', () => {
      expect(() => getKeyForVersion('invalid')).toThrow(
        'Invalid version format',
      );
      expect(() => getKeyForVersion('../etc/passwd')).toThrow(
        'Invalid version format',
      );
    });
  });

  describe('hashForQuery', () => {
    it('should produce deterministic HMAC-SHA256 hash', () => {
      const h1 = hashForQuery('13800138000');
      const h2 = hashForQuery('13800138000');
      expect(h1).toBe(h2);
      expect(h1.length).toBe(64); // hex length of SHA-256
    });

    it('should produce different hashes for different inputs', () => {
      const h1 = hashForQuery('13800138000');
      const h2 = hashForQuery('13800138001');
      expect(h1).not.toBe(h2);
    });

    it('should throw when PHONE_HASH_SECRET is missing', () => {
      const saved = process.env.PHONE_HASH_SECRET;
      delete (process.env as Record<string, string>).PHONE_HASH_SECRET;
      expect(() => hashForQuery('13800138000')).toThrow('PHONE_HASH_SECRET');
      process.env.PHONE_HASH_SECRET = saved;
    });

    it('should produce different hashes with different secrets', () => {
      const h1 = hashForQuery('13800138000');
      process.env.PHONE_HASH_SECRET = 'different-secret-key-32bytes!!';
      const h2 = hashForQuery('13800138000');
      expect(h1).not.toBe(h2);
      process.env.PHONE_HASH_SECRET = originalPhoneSecret;
    });
  });
});
