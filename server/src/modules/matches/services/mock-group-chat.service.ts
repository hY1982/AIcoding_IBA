import { Injectable, Logger } from '@nestjs/common';
import { GroupChatProviderInterface } from '../interfaces/group-chat-provider.interface';

/**
 * Mock Group Chat Service
 *
 * Simulates IM service for MVP. Generates a random groupChatId
 * without calling any external API.
 *
 * Future: Replace with RongCloudService, AgoraService, etc.
 */
@Injectable()
export class MockGroupChatService implements GroupChatProviderInterface {
  private readonly logger = new Logger(MockGroupChatService.name);

  async createGroupChat(matchId: number, playerIds: number[]): Promise<string> {
    const groupChatId = `match_${matchId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    this.logger.log(
      `Mock group chat created: ${groupChatId} for match=${matchId}, players=${playerIds.length}`,
    );

    return groupChatId;
  }
}
