import { DataSource } from 'typeorm';
import { Feedback } from '@modules/feedbacks/entities/feedback.entity';
import { FeedbackPlayerRating } from '@modules/feedbacks/entities/feedback-player-rating.entity';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { Notification } from '@modules/notifications/entities/notification.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { Player } from '@modules/players/entities/player.entity';
import { User } from '@modules/users/entities/user.entity';
import {
  createTestMatch,
  createTestPlayer,
  createTestUser,
} from './match.factory';

export { createTestMatch, createTestPlayer, createTestUser };

/**
 * Create a test feedback with automatic dependency resolution.
 * If matchId/playerId are not provided, automatically creates test match and player.
 */
export async function createTestFeedback(
  dataSource: DataSource,
  overrides: Partial<Feedback> & { matchId?: number; playerId?: number } = {},
): Promise<Feedback> {
  const feedbackRepo = dataSource.getRepository(Feedback);

  let matchId = overrides.matchId;
  let playerId = overrides.playerId;

  if (!matchId) {
    const match = await createTestMatch(dataSource);
    matchId = match.id;
  }

  if (!playerId) {
    const player = await createTestPlayer(dataSource);
    playerId = player.id;
  }

  const feedback = feedbackRepo.create({
    matchId,
    playerId,
    overallRating: overrides.overallRating ?? 4,
    overallReason: overrides.overallReason ?? null,
    regionCode: overrides.regionCode ?? null,
  });
  return feedbackRepo.save(feedback);
}

/**
 * Create a test feedback player rating.
 */
export async function createTestFeedbackPlayerRating(
  dataSource: DataSource,
  feedbackId: number,
  ratedPlayerId: number,
  overrides: Partial<FeedbackPlayerRating> = {},
): Promise<FeedbackPlayerRating> {
  const ratingRepo = dataSource.getRepository(FeedbackPlayerRating);

  const rating = ratingRepo.create({
    feedbackId,
    ratedPlayerId,
    levelMatch: overrides.levelMatch ?? null,
    sportsmanship: overrides.sportsmanship ?? null,
    actionCleanliness: overrides.actionCleanliness ?? null,
    isPunctual: overrides.isPunctual ?? null,
  });
  return ratingRepo.save(rating);
}

/**
 * Create a test system parameter.
 */
export async function createTestSystemParam(
  dataSource: DataSource,
  overrides: Partial<SystemParam> = {},
): Promise<SystemParam> {
  const paramRepo = dataSource.getRepository(SystemParam);

  const param = paramRepo.create({
    paramKey: (overrides.paramKey ??
      `test_param_${Date.now()}`) as import('@shared/system').SystemParamKey,
    paramValue: overrides.paramValue ?? { test: true },
    description: overrides.description ?? null,
  });
  return paramRepo.save(param);
}

/**
 * Create a test notification with automatic dependency resolution.
 * If userId is not provided, automatically creates a test user.
 */
export async function createTestNotification(
  dataSource: DataSource,
  overrides: Partial<Notification> & { userId?: number } = {},
): Promise<Notification> {
  const notificationRepo = dataSource.getRepository(Notification);

  let userId = overrides.userId;

  if (!userId) {
    const user = await createTestUser(dataSource);
    userId = user.id;
  }

  const notification = notificationRepo.create({
    userId,
    type: overrides.type ?? 'system_announcement',
    title: overrides.title ?? 'Test Notification',
    content: overrides.content ?? 'This is a test notification.',
    data: overrides.data ?? null,
    isRead: overrides.isRead ?? false,
    sendStatus: overrides.sendStatus ?? 'pending',
    sentAt: overrides.sentAt ?? null,
    sentVia: overrides.sentVia ?? null,
    regionCode: overrides.regionCode ?? null,
  });
  return notificationRepo.save(notification);
}
