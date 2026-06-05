import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  PlayerRegisterDto,
  VenueManagerRegisterDto,
  PHONE_REGEX,
  PASSWORD_REGEX,
} from './register.dto';

describe('Register DTOs', () => {
  describe('PlayerRegisterDto', () => {
    it('should validate a correct player registration dto', async () => {
      const dto = plainToInstance(PlayerRegisterDto, {
        phone: '13800138000',
        password: 'Password123',
        nickname: 'TestPlayer',
        userType: 'player',
        age: 25,
        basketballAge: 5,
        gender: 'male',
        height: 180,
        weight: 75,
        positions: ['PG', 'SG'],
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid phone number', async () => {
      const dto = plainToInstance(PlayerRegisterDto, {
        phone: '123456',
        password: 'Password123',
        nickname: 'TestPlayer',
        userType: 'player',
        age: 25,
        basketballAge: 5,
        gender: 'male',
        height: 180,
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'phone')).toBe(true);
    });

    it('should reject weak password', async () => {
      const dto = plainToInstance(PlayerRegisterDto, {
        phone: '13800138000',
        password: '12345',
        nickname: 'TestPlayer',
        userType: 'player',
        age: 25,
        basketballAge: 5,
        gender: 'male',
        height: 180,
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('should reject too many positions', async () => {
      const dto = plainToInstance(PlayerRegisterDto, {
        phone: '13800138000',
        password: 'Password123',
        nickname: 'TestPlayer',
        userType: 'player',
        age: 25,
        basketballAge: 5,
        gender: 'male',
        height: 180,
        positions: ['PG', 'SG', 'SF', 'PF'],
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'positions')).toBe(true);
    });

    it('should reject invalid age', async () => {
      const dto = plainToInstance(PlayerRegisterDto, {
        phone: '13800138000',
        password: 'Password123',
        nickname: 'TestPlayer',
        userType: 'player',
        age: 150,
        basketballAge: 5,
        gender: 'male',
        height: 180,
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'age')).toBe(true);
    });
  });

  describe('VenueManagerRegisterDto', () => {
    it('should validate a correct venue manager registration dto', async () => {
      const dto = plainToInstance(VenueManagerRegisterDto, {
        phone: '13800138000',
        password: 'Password123',
        nickname: 'TestManager',
        userType: 'venue_manager',
        companyName: 'Test Company',
        contactName: 'Manager Zhang',
        contactPhone: '13800138111',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject missing company name', async () => {
      const dto = plainToInstance(VenueManagerRegisterDto, {
        phone: '13800138000',
        password: 'Password123',
        nickname: 'TestManager',
        userType: 'venue_manager',
        contactName: 'Manager Zhang',
        contactPhone: '13800138111',
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'companyName')).toBe(true);
    });
  });

  describe('Regex patterns', () => {
    it('PHONE_REGEX should match valid Chinese phone numbers', () => {
      expect(PHONE_REGEX.test('13800138000')).toBe(true);
      expect(PHONE_REGEX.test('15912345678')).toBe(true);
      expect(PHONE_REGEX.test('123456')).toBe(false);
      expect(PHONE_REGEX.test('1380013800')).toBe(false);
    });

    it('PASSWORD_REGEX should enforce complexity', () => {
      expect(PASSWORD_REGEX.test('Password123')).toBe(true);
      expect(PASSWORD_REGEX.test('password')).toBe(false);
      expect(PASSWORD_REGEX.test('12345678')).toBe(false);
      expect(PASSWORD_REGEX.test('Pass1')).toBe(false);
    });
  });
});
