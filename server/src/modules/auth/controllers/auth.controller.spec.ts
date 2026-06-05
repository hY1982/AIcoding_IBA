import { Test } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';
import { PlayerRegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { SendSmsCodeDto } from '../dto/send-sms-code.dto';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      sendSmsCode: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    authController = moduleRef.get<AuthController>(AuthController);
    authService = moduleRef.get(AuthService) as jest.Mocked<AuthService>;

    jest.clearAllMocks();
  });

  // Helper functions
  const createMockAuthResponse = () => ({
    user: {
      id: 1,
      phone: '138****8000',
      nickname: 'TestUser',
      userType: 'player' as const,
      status: 'active' as const,
      avatarUrl: undefined,
      regionCode: undefined,
    },
    tokens: {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    },
  });

  const createPlayerRegisterDto = (): PlayerRegisterDto => ({
    phone: '13800138000',
    password: 'Password123',
    nickname: 'TestPlayer',
    userType: 'player',
    age: 25,
    basketballAge: 5,
    gender: 'male',
    height: 180,
    weight: 75,
    wingspan: 185,
    standingReach: 230,
    jumpingReach: 320,
    positions: ['PG', 'SG'],
  });

  const createLoginDto = (): LoginDto => ({
    phone: '13800138000',
    password: 'Password123',
  });

  const createRefreshTokenDto = (): RefreshTokenDto => ({
    refreshToken: 'valid-refresh-token',
  });

  const createSendSmsCodeDto = (): SendSmsCodeDto => ({
    phone: '13800138000',
    scene: 'register',
  });

  describe('POST /auth/register', () => {
    it('should register a new player successfully', async () => {
      const mockResponse = createMockAuthResponse();
      authService.register.mockResolvedValue(mockResponse);

      const dto = createPlayerRegisterDto();
      const result = await authController.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResponse);
    });

    it('should register a new venue manager successfully', async () => {
      const mockResponse = {
        ...createMockAuthResponse(),
        user: {
          ...createMockAuthResponse().user,
          userType: 'venue_manager' as const,
          nickname: 'TestManager',
        },
      };
      authService.register.mockResolvedValue(mockResponse);

      const dto = {
        phone: '13800138111',
        password: 'Password123',
        nickname: 'TestManager',
        userType: 'venue_manager' as const,
        companyName: 'Test Company',
        contactName: 'Manager Zhang',
        contactPhone: '13800138112',
      };
      const result = await authController.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result.user.userType).toBe('venue_manager');
    });

    it('should propagate ConflictException for duplicate phone', async () => {
      authService.register.mockRejectedValue(
        new ConflictException('该手机号已被注册'),
      );

      const dto = createPlayerRegisterDto();
      await expect(authController.register(dto)).rejects.toThrow(
        ConflictException,
      );
      expect(authService.register).toHaveBeenCalledWith(dto);
    });

    it('should propagate BadRequestException for invalid DTO', async () => {
      authService.register.mockRejectedValue(
        new BadRequestException('Invalid input'),
      );

      const dto = createPlayerRegisterDto();
      await expect(authController.register(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const mockResponse = createMockAuthResponse();
      authService.login.mockResolvedValue(mockResponse);

      const dto = createLoginDto();
      const result = await authController.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResponse);
    });

    it('should reject login with non-existent user', async () => {
      authService.login.mockRejectedValue(
        new UnauthorizedException('手机号或密码错误'),
      );

      const dto = createLoginDto();
      await expect(authController.login(dto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authService.login).toHaveBeenCalledWith(dto);
    });

    it('should reject login with wrong password', async () => {
      authService.login.mockRejectedValue(
        new UnauthorizedException('手机号或密码错误'),
      );

      const dto = createLoginDto();
      await expect(authController.login(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should propagate BadRequestException for invalid login DTO', async () => {
      authService.login.mockRejectedValue(
        new BadRequestException('Invalid input'),
      );

      const dto = createLoginDto();
      await expect(authController.login(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh token with valid refresh token', async () => {
      const mockResponse = createMockAuthResponse();
      authService.refresh.mockResolvedValue(mockResponse);

      const dto = createRefreshTokenDto();
      const result = await authController.refresh(dto);

      expect(authService.refresh).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResponse);
    });

    it('should reject invalid refresh token', async () => {
      authService.refresh.mockRejectedValue(
        new UnauthorizedException('Refresh token 无效或已过期'),
      );

      const dto = createRefreshTokenDto();
      await expect(authController.refresh(dto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authService.refresh).toHaveBeenCalledWith(dto);
    });

    it('should propagate BadRequestException for invalid refresh DTO', async () => {
      authService.refresh.mockRejectedValue(
        new BadRequestException('Invalid input'),
      );

      const dto = createRefreshTokenDto();
      await expect(authController.refresh(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('POST /auth/sms-code', () => {
    it('should send sms code via service layer', async () => {
      const mockResponse = {
        success: true,
        requestId: 'mock-request-id-123',
        expiresIn: 300,
      };
      authService.sendSmsCode.mockResolvedValue(mockResponse);

      const dto = createSendSmsCodeDto();
      const result = await authController.sendSmsCode(dto);

      expect(authService.sendSmsCode).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResponse);
    });

    it('should propagate BadRequestException for invalid sms-code DTO', async () => {
      authService.sendSmsCode.mockRejectedValue(
        new BadRequestException('Invalid input'),
      );

      const dto = createSendSmsCodeDto();
      await expect(authController.sendSmsCode(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('service method delegation', () => {
    it('should delegate all register calls to authService.register', async () => {
      authService.register.mockResolvedValue(createMockAuthResponse());

      await authController.register(createPlayerRegisterDto());
      expect(authService.register).toHaveBeenCalledTimes(1);
    });

    it('should delegate all login calls to authService.login', async () => {
      authService.login.mockResolvedValue(createMockAuthResponse());

      await authController.login(createLoginDto());
      expect(authService.login).toHaveBeenCalledTimes(1);
    });

    it('should delegate all refresh calls to authService.refresh', async () => {
      authService.refresh.mockResolvedValue(createMockAuthResponse());

      await authController.refresh(createRefreshTokenDto());
      expect(authService.refresh).toHaveBeenCalledTimes(1);
    });

    it('should delegate all sms-code calls to authService.sendSmsCode', async () => {
      authService.sendSmsCode.mockResolvedValue({
        success: true,
        requestId: 'mock-id',
        expiresIn: 300,
      });

      await authController.sendSmsCode(createSendSmsCodeDto());
      expect(authService.sendSmsCode).toHaveBeenCalledTimes(1);
    });
  });
});
