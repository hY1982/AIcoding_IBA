import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter } from 'events';
import { MatchMessage } from '../entities/match-message.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { SendMessageDto } from '../dto/send-message.dto';
import { QueryMessageDto } from '../dto/query-message.dto';
import { PaginatedResponse } from '@shared/common';

/**
 * MessageSentEvent payload
 *
 *  emitted via EventEmitter after a message is successfully persisted.
 *  Consumers (e.g., WebSocket gateway in Phase 4) can listen to broadcast
 *  the message to connected clients in real time.
 */
export interface MessageSentEvent {
  id: number;
  matchId: number;
  senderId: number;
  content: string;
  messageType: string;
  createdAt: Date;
}

/**
 * Message Service
 *
 * Core service for match group chat operations.
 *
 * Responsibilities:
 * - Send messages with participant validation and expiry checks
 * - Send system messages (internal use only)
 * - Query paginated message history
 * - Emit domain events for real-time push (WebSocket) integration
 *
 * Security:
 * - Sender identity is provided by the controller (from JWT), never from DTO
 * - Only match participants can send/view messages
 * - System message type is restricted to internal method
 *
 * Configurability:
 * - Group chat expiry days are read from system_params table
 *   (key: group_chat_expiry_days, default: 7)
 */
@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);
  private readonly defaultExpiryDays = 7;

  constructor(
    @InjectRepository(MatchMessage)
    private readonly messageRepo: Repository<MatchMessage>,
    @InjectRepository(Match)
    private readonly matchRepo: Repository<Match>,
    @InjectRepository(MatchPlayer)
    private readonly matchPlayerRepo: Repository<MatchPlayer>,
    @InjectRepository(SystemParam)
    private readonly systemParamRepo: Repository<SystemParam>,
    private readonly eventEmitter: EventEmitter,
  ) {}

  // ==================== SEND MESSAGE ====================

  /**
   * Send a message to a match group chat.
   *
   * Validation chain:
   * 1. Match must exist
   * 2. Sender must be a match participant (match_players table)
   * 3. Group chat must not have expired (configurable via system_params)
   * 4. Content must be non-empty and within max length (1000 chars)
   * 5. Message type must be text or image (system is not allowed)
   *
   * On success, emits 'message:sent' event for WebSocket broadcast.
   *
   * @param matchId - The match ID
   * @param senderId - The sender user ID (from JWT, provided by controller)
   * @param dto - Send message DTO
   * @returns The saved MatchMessage entity
   */
  async sendMessage(
    matchId: number,
    senderId: number,
    dto: SendMessageDto,
  ): Promise<MatchMessage> {
    // 1. Validate match exists
    const match = await this.matchRepo.findOneBy({ id: matchId });
    if (!match) {
      throw new NotFoundException(`比赛不存在: matchId=${matchId}`);
    }

    // 2. Validate sender is a participant
    const isParticipant = await this.isMatchParticipant(matchId, senderId);
    if (!isParticipant) {
      throw new ForbiddenException(
        `用户 ${senderId} 不是比赛 ${matchId} 的参与者，无法发送消息`,
      );
    }

    // 3. Validate group chat has not expired
    const canSend = await this.canSendMessages(match);
    if (!canSend) {
      throw new ForbiddenException('群聊已超过有效期，无法发送新消息');
    }

    // 4. Validate content
    const trimmedContent = dto.content.trim();
    if (trimmedContent.length === 0) {
      throw new BadRequestException('消息内容不能为空');
    }
    if (trimmedContent.length > 1000) {
      throw new BadRequestException('消息内容不能超过 1000 字符');
    }

    // 5. Validate message type (system is not allowed for users)
    // Use type assertion to allow runtime check against 'system' even though
    // SendMessageDto restricts the type to 'text' | 'image'. This catches
    // cases where the DTO validation is bypassed or the type is cast.
    const messageType = (dto.messageType ?? 'text') as string;
    if (messageType === 'system') {
      throw new BadRequestException('普通用户不能发送系统消息');
    }

    const message = this.messageRepo.create({
      matchId,
      senderId,
      content: trimmedContent,
      messageType: messageType as 'text' | 'image' | 'system',
    });

    const saved = await this.messageRepo.save(message);

    // Emit domain event for real-time push
    this.emitMessageSent(saved);

    this.logger.log(
      `Message sent: id=${saved.id}, matchId=${matchId}, senderId=${senderId}, type=${messageType}`,
    );

    return saved;
  }

  /**
   * Send a system message to a match group chat.
   *
   * Internal method for backend services (e.g., match confirmation,
   * scheduled tasks) to post system announcements.
   *
   * Does NOT validate sender identity (no senderId).
   * Still validates group chat expiry.
   *
   * @param matchId - The match ID
   * @param content - The system message content
   * @returns The saved MatchMessage entity
   */
  async sendSystemMessage(
    matchId: number,
    content: string,
  ): Promise<MatchMessage> {
    const match = await this.matchRepo.findOneBy({ id: matchId });
    if (!match) {
      throw new NotFoundException(`比赛不存在: matchId=${matchId}`);
    }

    const canSend = await this.canSendMessages(match);
    if (!canSend) {
      throw new ForbiddenException('群聊已超过有效期，无法发送系统消息');
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      throw new BadRequestException('系统消息内容不能为空');
    }

    const message = this.messageRepo.create({
      matchId,
      senderId: 0, // System messages use senderId = 0
      content: trimmedContent,
      messageType: 'system',
    });

    const saved = await this.messageRepo.save(message);

    this.logger.log(
      `System message sent: id=${saved.id}, matchId=${matchId}, content="${trimmedContent}"`,
    );

    return saved;
  }

  // ==================== QUERY MESSAGE HISTORY ====================

  /**
   * Get paginated message history for a match.
   *
   * Only match participants can view the message history.
   * Messages are ordered by createdAt DESC (newest first).
   *
   * @param matchId - The match ID
   * @param userId - The requesting user ID
   * @param query - Pagination parameters
   * @returns Paginated list of MatchMessage entities
   */
  async getMessageHistory(
    matchId: number,
    userId: number,
    query: QueryMessageDto,
  ): Promise<PaginatedResponse<MatchMessage>> {
    // Validate match exists
    const match = await this.matchRepo.findOneBy({ id: matchId });
    if (!match) {
      throw new NotFoundException(`比赛不存在: matchId=${matchId}`);
    }

    // Validate user is a participant
    const isParticipant = await this.isMatchParticipant(matchId, userId);
    if (!isParticipant) {
      throw new ForbiddenException(
        `用户 ${userId} 不是比赛 ${matchId} 的参与者，无法查看消息`,
      );
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const qb = this.messageRepo
      .createQueryBuilder('message')
      .where('message.match_id = :matchId', { matchId })
      .orderBy('message.created_at', 'DESC')
      .skip(skip)
      .take(pageSize);

    const [list, total] = await qb.getManyAndCount();

    return { page, pageSize, total, list };
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Check if a user is a participant of a match.
   *
   * Looks up the match_players table for any record with the given
   * matchId and playerId (which corresponds to userId for players).
   */
  private async isMatchParticipant(
    matchId: number,
    userId: number,
  ): Promise<boolean> {
    const count = await this.matchPlayerRepo.count({
      where: { matchId, playerId: userId },
    });
    return count > 0;
  }

  /**
   * Check if messages can still be sent to a match group chat.
   *
   * Reads the expiry configuration from system_params table.
   * Defaults to 7 days if the parameter is not found.
   *
   * A match is considered expired when:
   *   now - match.createdAt > expiryDays * 24 * 60 * 60 * 1000
   *
   * Messages sent exactly at the boundary (createdAt + expiryDays)
   * are still allowed (<= comparison).
   */
  private async canSendMessages(match: Match): Promise<boolean> {
    const expiryDays = await this.getExpiryDays();
    const now = Date.now();
    const createdAt = match.createdAt.getTime();
    const expiryTime = createdAt + expiryDays * 24 * 60 * 60 * 1000;

    return now <= expiryTime;
  }

  /**
   * Get the configured group chat expiry days.
   *
   * Reads from system_params table. Returns default (7) if:
   * - Parameter not found
   * - Parameter value is invalid
   */
  private async getExpiryDays(): Promise<number> {
    try {
      const param = await this.systemParamRepo.findOneBy({
        paramKey: 'group_chat_expiry_days',
      });
      if (param && param.paramValue && typeof param.paramValue === 'object') {
        const value = param.paramValue as Record<string, unknown>;
        if (typeof value.expiry_days === 'number' && value.expiry_days > 0) {
          return value.expiry_days;
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to read group_chat_expiry_days from system_params: ${(error as Error).message}. Using default.`,
      );
    }
    return this.defaultExpiryDays;
  }

  /**
   * Emit 'message:sent' domain event.
   *
   * Consumers (e.g., ChatGateway in Phase 4) listen to this event
   * to broadcast the message to connected WebSocket clients.
   */
  private emitMessageSent(message: MatchMessage): void {
    const event: MessageSentEvent = {
      id: message.id,
      matchId: message.matchId,
      senderId: message.senderId,
      content: message.content,
      messageType: message.messageType,
      createdAt: message.createdAt,
    };
    this.eventEmitter.emit('message:sent', event);
  }
}
