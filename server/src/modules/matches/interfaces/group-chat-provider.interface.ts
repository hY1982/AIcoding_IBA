/**
 * Group Chat Provider Interface
 *
 * Abstracts IM service operations for creating match group chats.
 * Allows seamless switching between different IM providers
 * (RongCloud, Agora, Tencent IM, etc.).
 *
 * For MVP: MockGroupChatService generates a random groupChatId.
 * For production: Implement with actual IM SDK.
 */

export const GROUP_CHAT_PROVIDER = Symbol('GROUP_CHAT_PROVIDER');

export interface GroupChatProviderInterface {
  /**
   * Create a group chat for a match.
   *
   * @param matchId - The match ID
   * @param playerIds - Array of player user IDs to invite
   * @returns The created group chat room ID
   */
  createGroupChat(matchId: number, playerIds: number[]): Promise<string>;
}
