/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { EncryptTransformer } from './encrypt.transformer';
import { encrypt, decrypt } from '@common/utils/encrypt.util';

jest.mock('@common/utils/encrypt.util');

describe('EncryptTransformer', () => {
  const mockedEncrypt = jest.mocked(encrypt);
  const mockedDecrypt = jest.mocked(decrypt);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('to', () => {
    it('should encrypt a string value', () => {
      const mockEncrypted = 'v1:iv:tag:cipher';
      mockedEncrypt.mockReturnValue(mockEncrypted);

      const result = EncryptTransformer.to('13800138000');

      expect(mockedEncrypt).toHaveBeenCalledWith('13800138000');
      expect(result).toBe(mockEncrypted);
    });

    it('should return null for null value', () => {
      const result = EncryptTransformer.to(null);
      expect(result).toBeNull();
      expect(mockedEncrypt).not.toHaveBeenCalled();
    });

    it('should return undefined for undefined value', () => {
      const result = EncryptTransformer.to(undefined);
      expect(result).toBeUndefined();
      expect(mockedEncrypt).not.toHaveBeenCalled();
    });

    it('should return empty string for empty string value', () => {
      const mockEncrypted = 'v1:iv:tag:';
      mockedEncrypt.mockReturnValue(mockEncrypted);

      const result = EncryptTransformer.to('');

      expect(mockedEncrypt).toHaveBeenCalledWith('');
      expect(result).toBe(mockEncrypted);
    });
  });

  describe('from', () => {
    it('should decrypt a string value', () => {
      const mockDecrypted = '13800138000';
      mockedDecrypt.mockReturnValue(mockDecrypted);

      const result = EncryptTransformer.from('v1:iv:tag:cipher');

      expect(mockedDecrypt).toHaveBeenCalledWith('v1:iv:tag:cipher');
      expect(result).toBe(mockDecrypted);
    });

    it('should return null for null value', () => {
      const result = EncryptTransformer.from(null);
      expect(result).toBeNull();
      expect(mockedDecrypt).not.toHaveBeenCalled();
    });

    it('should return undefined for undefined value', () => {
      const result = EncryptTransformer.from(undefined);
      expect(result).toBeUndefined();
      expect(mockedDecrypt).not.toHaveBeenCalled();
    });

    it('should wrap decryption errors with context', () => {
      mockedDecrypt.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      expect(() => EncryptTransformer.from('invalid')).toThrow(
        'Failed to decrypt field value: Decryption failed',
      );
    });

    it('should throw TypeError for non-string value in to()', () => {
      expect(() => EncryptTransformer.to(123)).toThrow(
        'EncryptTransformer expected string for encrypt, got number',
      );
      expect(() => EncryptTransformer.to({})).toThrow(
        'EncryptTransformer expected string for encrypt, got object',
      );
    });

    it('should throw TypeError for non-string value in from()', () => {
      expect(() => EncryptTransformer.from(123)).toThrow(
        'EncryptTransformer expected string for decrypt, got number',
      );
    });
  });
});
