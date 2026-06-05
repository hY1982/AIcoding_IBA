import { DataSource, Repository } from 'typeorm';
import { User } from '@modules/users/entities/user.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { Player } from '@modules/players/entities/player.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { MatchTeam } from '@modules/matches/entities/match-team.entity';
import { MatchMessage } from '@modules/messages/entities/match-message.entity';
import { hashForQuery } from '@common/utils/encrypt.util';

function nextPhone(): string {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 10000);
  return `138${String(ts % 100000000).padStart(8, '0')}${String(rand).padStart(4, '0')}`.slice(
    0,
    11,
  );
}

function nextVenueName(): string {
  return `Test Court ${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

/**
 * Create a test user.
 */
export async function createTestUser(
  dataSource: DataSource,
  overrides: Partial<User> = {},
): Promise<User> {
  const userRepo = dataSource.getRepository(User);
  const phone = overrides.phone ?? nextPhone();
  const user = userRepo.create({
    phone,
    phoneHash: hashForQuery(phone),
    passwordHash: 'hashed_password',
    nickname: overrides.nickname ?? `User_${phone.slice(-4)}`,
    userType: overrides.userType ?? 'player',
    status: overrides.status ?? 'active',
    ...overrides,
  });
  return userRepo.save(user);
}

/**
 * Create a test player with an associated user.
 */
export async function createTestPlayer(
  dataSource: DataSource,
  overrides: Partial<Player> = {},
): Promise<Player> {
  const userRepo = dataSource.getRepository(User);
  const playerRepo = dataSource.getRepository(Player);

  const user = await createTestUser(dataSource);
  const player = playerRepo.create({
    userId: user.id,
    age: overrides.age ?? 25,
    basketballAge: overrides.basketballAge ?? 5,
    gender: overrides.gender ?? 'male',
    height: overrides.height ?? 180,
    baseAbilityScore: overrides.baseAbilityScore ?? 50,
    matchAdjustValue: overrides.matchAdjustValue ?? 0,
    regionCode: overrides.regionCode ?? 'shenzhen_futian',
    ...overrides,
  });
  return playerRepo.save(player);
}

/**
 * Create a test venue manager with an associated user.
 */
export async function createTestVenueManager(
  dataSource: DataSource,
  overrides: Partial<VenueManager> = {},
): Promise<VenueManager> {
  const userRepo = dataSource.getRepository(User);
  const vmRepo = dataSource.getRepository(VenueManager);

  const user = await createTestUser(dataSource, {
    userType: 'venue_manager',
    nickname: overrides.companyName ?? 'Manager',
  });

  const vm = vmRepo.create({
    userId: user.id,
    companyName: overrides.companyName ?? 'Test Sports Co.',
    ...overrides,
  });
  return vmRepo.save(vm);
}

/**
 * Create a test venue with an associated venue manager.
 */
export async function createTestVenue(
  dataSource: DataSource,
  overrides: Partial<Venue> = {},
): Promise<Venue> {
  const venueRepo = dataSource.getRepository(Venue);

  const vm = await createTestVenueManager(dataSource);

  const venue = venueRepo.create({
    managerId: vm.id,
    name: overrides.name ?? nextVenueName(),
    address: overrides.address ?? 'Test Address',
    pricePerHour: overrides.pricePerHour ?? 200,
    courtCount: overrides.courtCount ?? 1,
    regionCode: overrides.regionCode ?? 'shenzhen_futian',
    ...overrides,
  });
  return venueRepo.save(venue);
}

/**
 * Create a test format.
 */
export async function createTestFormat(
  dataSource: DataSource,
  overrides: Partial<Format> = {},
): Promise<Format> {
  const formatRepo = dataSource.getRepository(Format);

  const format = formatRepo.create({
    name: overrides.name ?? '3v3 Short',
    formatType: overrides.formatType ?? 'short',
    teamSize: overrides.teamSize ?? 3,
    teamCountMin: overrides.teamCountMin ?? 3,
    teamCountMax: overrides.teamCountMax ?? 4,
    ...overrides,
  });
  return formatRepo.save(format);
}

/**
 * Create a test match with associated venue and format.
 * Automatically creates venue and format if not provided via overrides.
 */
export async function createTestMatch(
  dataSource: DataSource,
  overrides: Partial<Match> & { venueId?: number; formatId?: number } = {},
): Promise<Match> {
  const matchRepo = dataSource.getRepository(Match);

  let venueId = overrides.venueId;
  let formatId = overrides.formatId;

  if (!venueId) {
    const venue = await createTestVenue(dataSource);
    venueId = venue.id;
  }

  if (!formatId) {
    const format = await createTestFormat(dataSource);
    formatId = format.id;
  }

  const startTime =
    overrides.startTime ?? new Date('2026-06-15T14:00:00+08:00');
  const endTime = overrides.endTime ?? new Date('2026-06-15T16:00:00+08:00');

  const match = matchRepo.create({
    venueId,
    formatId,
    startTime,
    endTime,
    status: overrides.status ?? 'pending_confirmation',
    teamCount: overrides.teamCount ?? 3,
    playersPerTeam: overrides.playersPerTeam ?? 3,
    totalPlayers: overrides.totalPlayers ?? 9,
    depositAmount: overrides.depositAmount ?? '50.00',
    regionCode: overrides.regionCode ?? 'shenzhen_futian',
    ...overrides,
  });

  // Remove venueId and formatId from overrides to avoid duplicate assignment
  // since they are already set above
  return matchRepo.save(match);
}

/**
 * Create a test match player association.
 */
export async function createTestMatchPlayer(
  dataSource: DataSource,
  matchId: number,
  playerId: number,
  overrides: Partial<MatchPlayer> = {},
): Promise<MatchPlayer> {
  const mpRepo = dataSource.getRepository(MatchPlayer);

  const mp = mpRepo.create({
    matchId,
    playerId,
    teamNumber: overrides.teamNumber ?? null,
    isReserve: overrides.isReserve ?? false,
    depositPaid: overrides.depositPaid ?? false,
    status: overrides.status ?? 'invited',
    ...overrides,
  });
  return mpRepo.save(mp);
}

/**
 * Create a test match team.
 */
export async function createTestMatchTeam(
  dataSource: DataSource,
  matchId: number,
  teamNumber: number,
  overrides: Partial<MatchTeam> = {},
): Promise<MatchTeam> {
  const mtRepo = dataSource.getRepository(MatchTeam);

  const mt = mtRepo.create({
    matchId,
    teamNumber,
    teamName: overrides.teamName ?? `Team ${teamNumber}`,
    avgAbility: overrides.avgAbility ?? null,
    ...overrides,
  });
  return mtRepo.save(mt);
}

/**
 * Create a test match message.
 */
export async function createTestMatchMessage(
  dataSource: DataSource,
  matchId: number,
  senderId: number,
  overrides: Partial<MatchMessage> = {},
): Promise<MatchMessage> {
  const msgRepo = dataSource.getRepository(MatchMessage);

  const msg = msgRepo.create({
    matchId,
    senderId,
    content: overrides.content ?? 'Hello, this is a test message.',
    messageType: overrides.messageType ?? 'text',
    ...overrides,
  });
  return msgRepo.save(msg);
}
