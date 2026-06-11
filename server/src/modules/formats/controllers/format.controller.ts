import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Format } from '../entities/format.entity';
import { Public } from '@modules/auth/decorators/public.decorator';

/**
 * 赛制控制器
 *
 * 提供赛制列表查询接口（公开端点，无需认证）。
 * 仅返回 isActive=true 的赛制。
 */
@ApiTags('赛制')
@Controller('formats')
export class FormatController {
  constructor(
    @InjectRepository(Format)
    private readonly formatRepo: Repository<Format>,
  ) {}

  /**
   * GET /api/v1/formats
   * 获取活跃赛制列表
   */
  @Get()
  @Public()
  @ApiOperation({ summary: '获取活跃赛制列表' })
  @ApiResponse({ status: 200, description: '返回活跃赛制列表' })
  async findAll(): Promise<Format[]> {
    return this.formatRepo.find({ where: { isActive: true } });
  }
}
