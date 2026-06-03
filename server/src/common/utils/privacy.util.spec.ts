import { maskPhone, maskRealName, maskIdCard } from './privacy.util';

describe('PrivacyUtil', () => {
  describe('maskPhone', () => {
    it('should mask 11-digit phone number correctly', () => {
      expect(maskPhone('13812345678')).toBe('138****5678');
    });

    it('should mask phone starting with different prefix', () => {
      expect(maskPhone('15987654321')).toBe('159****4321');
    });

    it('should return empty string for null', () => {
      expect(maskPhone(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(maskPhone(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(maskPhone('')).toBe('');
    });

    it('should return original value for non-11-digit string', () => {
      // Encrypted phone or invalid format
      expect(maskPhone('v1:abc:def:encrypted')).toBe('v1:abc:def:encrypted');
    });

    it('should return original value for 10-digit string', () => {
      expect(maskPhone('1234567890')).toBe('1234567890');
    });

    it('should return original value for 12-digit string', () => {
      expect(maskPhone('123456789012')).toBe('123456789012');
    });
  });

  describe('maskRealName', () => {
    it('should mask 3-character name', () => {
      expect(maskRealName('张三丰')).toBe('张**');
    });

    it('should mask 2-character name', () => {
      expect(maskRealName('张三')).toBe('张**');
    });

    it('should return original for single-character name', () => {
      expect(maskRealName('张')).toBe('张');
    });

    it('should mask long name', () => {
      expect(maskRealName('欧阳锋')).toBe('欧**');
    });

    it('should return empty string for null', () => {
      expect(maskRealName(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(maskRealName(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(maskRealName('')).toBe('');
    });
  });

  describe('maskIdCard', () => {
    it('should mask 18-digit ID card', () => {
      expect(maskIdCard('110101199001011234')).toBe('110***********1234');
    });

    it('should mask 15-digit ID card', () => {
      expect(maskIdCard('110101900101123')).toBe('110********1123');
    });

    it('should return original for short string', () => {
      expect(maskIdCard('12345')).toBe('12345');
    });

    it('should return empty string for null', () => {
      expect(maskIdCard(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(maskIdCard(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(maskIdCard('')).toBe('');
    });
  });
});
