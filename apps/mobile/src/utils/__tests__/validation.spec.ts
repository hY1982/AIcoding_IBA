import {
  validatePhone,
  validatePassword,
  validateNickname,
  validatePlayerAge,
  validateHeight,
  validatePositions,
  validateCompanyName,
  validateContactName,
  validateContactPhone,
} from '../validation';

describe('Validation Utils', () => {
  describe('validatePhone', () => {
    it('should pass for valid phone number 13800138000', () => {
      expect(validatePhone('13800138000')).toBeNull();
    });

    it('should reject empty string', () => {
      expect(validatePhone('')).toBe('请输入手机号');
    });

    it('should reject phone number not starting with 1', () => {
      expect(validatePhone('12345678901')).toBe('请输入有效的11位手机号码');
    });

    it('should reject phone number with 10 digits', () => {
      expect(validatePhone('1380013800')).toBe('请输入有效的11位手机号码');
    });

    it('should reject phone number with 12 digits', () => {
      expect(validatePhone('138001380000')).toBe('请输入有效的11位手机号码');
    });
  });

  describe('validatePassword', () => {
    it('should pass for valid password Abc12345', () => {
      expect(validatePassword('Abc12345')).toBeNull();
    });

    it('should reject password with 6 characters', () => {
      expect(validatePassword('abc123')).toBe('密码必须至少8位，且包含至少1个字母和1个数字');
    });

    it('should reject password without digits', () => {
      expect(validatePassword('abcdefgh')).toBe('密码必须至少8位，且包含至少1个字母和1个数字');
    });

    it('should reject password without letters', () => {
      expect(validatePassword('12345678')).toBe('密码必须至少8位，且包含至少1个字母和1个数字');
    });

    it('should reject empty password', () => {
      expect(validatePassword('')).toBe('请输入密码');
    });
  });

  describe('validateNickname', () => {
    it('should pass for valid nickname', () => {
      expect(validateNickname('TestPlayer')).toBeNull();
    });

    it('should reject empty string', () => {
      expect(validateNickname('')).toBe('请输入昵称');
    });

    it('should reject nickname over 50 characters', () => {
      expect(validateNickname('a'.repeat(51))).toBe('昵称不能超过50个字符');
    });

    it('should pass for exactly 50 characters', () => {
      expect(validateNickname('a'.repeat(50))).toBeNull();
    });
  });

  describe('validatePlayerAge', () => {
    it('should pass for age 25', () => {
      expect(validatePlayerAge(25)).toBeNull();
    });

    it('should reject age 0', () => {
      expect(validatePlayerAge(0)).toBe('年龄必须在1-120之间');
    });

    it('should reject age 121', () => {
      expect(validatePlayerAge(121)).toBe('年龄必须在1-120之间');
    });

    it('should pass for boundary values 1 and 120', () => {
      expect(validatePlayerAge(1)).toBeNull();
      expect(validatePlayerAge(120)).toBeNull();
    });
  });

  describe('validateHeight', () => {
    it('should reject height 49', () => {
      expect(validateHeight(49)).toBe('身高必须在50-300cm之间');
    });

    it('should reject height 301', () => {
      expect(validateHeight(301)).toBe('身高必须在50-300cm之间');
    });

    it('should pass for height 180', () => {
      expect(validateHeight(180)).toBeNull();
    });
  });

  describe('validatePositions', () => {
    it('should pass for valid positions PG and SG', () => {
      expect(validatePositions(['PG', 'SG'])).toBeNull();
    });

    it('should reject more than 3 positions', () => {
      expect(validatePositions(['PG', 'SG', 'SF', 'PF'])).toBe('最多选择3个位置');
    });

    it('should reject invalid position', () => {
      expect(validatePositions(['PG', 'XX'] as string[])).toBe('位置必须是 PG, SG, SF, PF, C 之一');
    });

    it('should pass for exactly 3 positions', () => {
      expect(validatePositions(['PG', 'SG', 'SF'])).toBeNull();
    });
  });

  describe('validateCompanyName', () => {
    it('should pass for valid company name', () => {
      expect(validateCompanyName('Test Company')).toBeNull();
    });

    it('should reject empty string', () => {
      expect(validateCompanyName('')).toBe('请输入公司名称');
    });

    it('should reject company name over 100 characters', () => {
      expect(validateCompanyName('a'.repeat(101))).toBe('公司名称不能超过100个字符');
    });
  });

  describe('validateContactName', () => {
    it('should pass for valid contact name', () => {
      expect(validateContactName('Manager Zhang')).toBeNull();
    });

    it('should reject empty string', () => {
      expect(validateContactName('')).toBe('请输入联系人姓名');
    });

    it('should reject contact name over 50 characters', () => {
      expect(validateContactName('a'.repeat(51))).toBe('联系人姓名不能超过50个字符');
    });
  });

  describe('validateContactPhone', () => {
    it('should pass for valid contact phone', () => {
      expect(validateContactPhone('13800138111')).toBeNull();
    });

    it('should reject invalid phone format', () => {
      expect(validateContactPhone('12345678901')).toBe('请输入有效的11位手机号码');
    });

    it('should reject empty string', () => {
      expect(validateContactPhone('')).toBe('请输入联系人手机号');
    });
  });
});
