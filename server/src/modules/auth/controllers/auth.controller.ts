import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { Public } from '../decorators/public.decorator';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { SendSmsCodeDto } from '../dto/send-sms-code.dto';
import { AuthResponse } from '@shared/auth';

/**
 * 认证控制器
 *
 * 提供用户注册、登录、Token 刷新、短信验证码等认证相关接口。
 * 所有端点均为公开访问（无需 JWT 认证）。
 */
@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 用户注册
   *
   * 支持球员和场地方两种角色注册。
   */
  @Post('register')
  @Public()
  @ApiOperation({ summary: '用户注册' })
  @ApiBody({
    description: '注册信息',
    type: Object,
    examples: {
      player: {
        summary: '球员注册示例',
        value: {
          phone: '13800138000',
          password: 'Password123',
          nickname: 'TestPlayer',
          userType: 'player',
          age: 25,
          basketballAge: 5,
          gender: 'male',
          height: 180,
        },
      },
      venueManager: {
        summary: '场地方注册示例',
        value: {
          phone: '13800138111',
          password: 'Password123',
          nickname: 'TestManager',
          userType: 'venue_manager',
          companyName: 'Test Company',
          contactName: 'Manager Zhang',
          contactPhone: '13800138112',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: '注册成功',
  })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 409, description: '手机号已被注册' })
  async register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  /**
   * 用户登录
   */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录' })
  @ApiBody({
    description: '登录信息',
    examples: {
      default: {
        summary: '登录示例',
        value: {
          phone: '13800138000',
          password: 'Password123',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '登录成功',
  })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '手机号或密码错误' })
  async login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  /**
   * 刷新 Token
   *
   * 使用有效的 refreshToken 获取新的 accessToken 和 refreshToken。
   * 旧的 refreshToken 会立即失效（单次使用轮换策略）。
   */
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新 Token' })
  @ApiBody({
    description: '刷新令牌',
    examples: {
      default: {
        summary: '刷新示例',
        value: {
          refreshToken: 'eyJhbGciOiJIUzI1NiIs...',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '刷新成功',
  })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: 'Refresh token 无效或已过期' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponse> {
    return this.authService.refresh(dto);
  }

  /**
   * 发送短信验证码
   *
   * ⚠️ MVP 阶段为模拟实现，直接返回成功响应，不实际发送短信。
   * 生产环境需替换为真实的短信服务实现。
   */
  @Post('sms-code')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '发送短信验证码',
    description: '⚠️ 此为模拟实现，仅用于开发和测试环境',
  })
  @ApiBody({
    description: '短信验证码请求',
    examples: {
      default: {
        summary: '发送验证码示例',
        value: {
          phone: '13800138000',
          scene: 'register',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '模拟发送成功',
  })
  @ApiResponse({ status: 400, description: '请求参数错误（手机号格式不正确）' })
  async sendSmsCode(
    @Body() dto: SendSmsCodeDto,
  ): Promise<{ success: boolean; requestId: string; expiresIn: number }> {
    return this.authService.sendSmsCode(dto);
  }
}
