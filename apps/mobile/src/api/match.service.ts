import { apiClient } from './client';
import { extractApiErrorMessage } from './error';
import type { MatchStatus, MatchPlayerStatus, MessageType } from '@shared/match';
import type { PaginatedResponse } from '@shared/common';

export class MatchServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MatchServiceError';
  }
}

// ==================== Response Types ====================

export interface MatchListResponse {
  id: number;
  venueId: number;
  venueName: string | null;
  formatId: number;
  formatName: string | null;
  startTime: string;
  endTime: string;
  status: MatchStatus;
  teamCount: number;
  playersPerTeam: number;
  totalPlayers: number;
  confirmedPlayers: number;
  requiredPlayers: number;
  maxPlayers: number;
  minPlayers: number;
  depositAmount: string;
  regionCode: string | null;
  playerStatus: MatchPlayerStatus;
  teamNumber: number | null;
  confirmDeadline: string | null;
  venueConfirmDeadline: string | null;
  cancelledReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatchTeamItem {
  teamNumber: number;
  teamName: string | null;
  avgAbility: string | null;
}

export interface MatchPlayerItem {
  playerId: number;
  nickname: string | null;
  teamNumber: number | null;
  status: MatchPlayerStatus;
}

export interface MatchDetailResponse extends MatchListResponse {
  teams: MatchTeamItem[];
  players: MatchPlayerItem[];
  groupChatId: string | null;
}

export interface ConfirmParticipationResult {
  success: boolean;
  matchId: number;
  playerId: number;
  orderNo: string;
  status: MatchPlayerStatus;
  matchStatus: MatchStatus;
  message: string;
  alreadyConfirmed?: boolean;
}

export interface DeclineParticipationResult {
  success: boolean;
  message: string;
}

export interface MatchMessage {
  id: number;
  matchId: number;
  senderId: number;
  senderNickname: string | null;
  content: string;
  messageType: MessageType;
  createdAt: string;
}

// ==================== Request Params ====================

export interface GetMyMatchesParams {
  page?: number;
  pageSize?: number;
  status?: MatchStatus;
}

export interface GetMessagesParams {
  page?: number;
  pageSize?: number;
}

export interface SendMessageDto {
  content: string;
  messageType?: MessageType;
}

// ==================== Service ====================

class MatchService {
  async getMyMatches(params?: GetMyMatchesParams): Promise<PaginatedResponse<MatchListResponse>> {
    try {
      const response = await apiClient.get<{ data: PaginatedResponse<MatchListResponse> }>(
        '/matches/my',
        { params },
      );
      return response.data.data;
    } catch (error) {
      const userMessage = extractApiErrorMessage(error);
      throw new MatchServiceError(userMessage);
    }
  }

  async getMatchDetail(id: number): Promise<MatchDetailResponse> {
    try {
      const response = await apiClient.get<{ data: MatchDetailResponse }>(`/matches/${id}`);
      return response.data.data;
    } catch (error) {
      const userMessage = extractApiErrorMessage(error);
      throw new MatchServiceError(userMessage);
    }
  }

  async confirmParticipation(id: number): Promise<ConfirmParticipationResult> {
    try {
      const response = await apiClient.post<{ data: ConfirmParticipationResult }>(
        `/matches/${id}/confirm`,
      );
      return response.data.data;
    } catch (error) {
      const userMessage = extractApiErrorMessage(error);
      throw new MatchServiceError(userMessage);
    }
  }

  async declineParticipation(id: number): Promise<DeclineParticipationResult> {
    try {
      const response = await apiClient.post<{ data: DeclineParticipationResult }>(
        `/matches/${id}/decline`,
      );
      return response.data.data;
    } catch (error) {
      const userMessage = extractApiErrorMessage(error);
      throw new MatchServiceError(userMessage);
    }
  }

  async getMessages(
    matchId: number,
    params?: GetMessagesParams,
  ): Promise<PaginatedResponse<MatchMessage>> {
    try {
      const response = await apiClient.get<{ data: PaginatedResponse<MatchMessage> }>(
        `/matches/${matchId}/messages`,
        { params },
      );
      return response.data.data;
    } catch (error) {
      const userMessage = extractApiErrorMessage(error);
      throw new MatchServiceError(userMessage);
    }
  }

  async sendMessage(matchId: number, dto: SendMessageDto): Promise<MatchMessage> {
    try {
      const response = await apiClient.post<{ data: MatchMessage }>(
        `/matches/${matchId}/messages`,
        dto,
      );
      return response.data.data;
    } catch (error) {
      const userMessage = extractApiErrorMessage(error);
      throw new MatchServiceError(userMessage);
    }
  }
}

export const matchService = new MatchService();
