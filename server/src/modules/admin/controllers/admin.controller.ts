import { Controller, Get, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AdminService } from '../services/admin.service';
import { AdminGuard } from '../guards/admin.guard';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import {
  AdminListQuery,
  UpdateSystemParamRequest,
} from '@shared/admin';

/**
 * 管理后台 Controller
 *
 * 提供管理后台所需的 REST API，所有端点需要管理员权限。
 * 使用 @UseGuards(JwtAuthGuard, AdminGuard) 确保只有认证通过的管理员可访问。
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * 获取球员列表（完整信息，不脱敏）
   */
  @Get('players')
  async getPlayers(@Query() query: AdminListQuery) {
    return this.adminService.findPlayers(query);
  }

  /**
   * 获取场地列表
   */
  @Get('venues')
  async getVenues(@Query() query: AdminListQuery) {
    return this.adminService.findVenues(query);
  }

  /**
   * 获取比赛列表
   */
  @Get('matches')
  async getMatches(@Query() query: AdminListQuery) {
    return this.adminService.findMatches(query);
  }

  /**
   * 获取平台数据统计
   */
  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }

  /**
   * 获取系统参数列表
   */
  @Get('params')
  async getSystemParams() {
    return this.adminService.findSystemParams();
  }

  /**
   * 更新系统参数
   */
  @Put('params/:key')
  async updateSystemParam(
    @Param('key') key: string,
    @Body() dto: UpdateSystemParamRequest,
  ) {
    return this.adminService.updateSystemParam(key, dto.paramValue, dto.description);
  }
}
