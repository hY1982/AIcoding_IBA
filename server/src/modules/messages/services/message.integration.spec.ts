import { DataSource, Repository } from 'typeorm';
import { EventEmitter } from 'events';
import { MessageService } from './message.service';
import { MatchMessage } from '../entities/match-message.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { User } from '@modules/users/entities/user.entity';
import { Player } from '@modules/players/entities/player.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { IntentionVenue } from '@modules/intentions/entities/intention-venue.entity';
import { IntentionFormat } from '@modules/intentions/entities/intention-format.entity';
import { MatchTeam } from '@modules/matches/entities/match-team.entity';
import { Feedback } from '@modules/feedbacks/entities/feedback.entity';
import { FeedbackPlayerRating } from '@modules/feedbacks/entities/feedback-player-rating.entity';
import { AdjustUpdateFailure } from '@modules/feedbacks/entities/adjust-update-failure.entity';
import { PlayerPosition } from '@modules/players/entities/player-position.entity';
import { SendMessageDto } from '../dto/send-message.dto';
import { hashForQuery } from '@common/utils/encrypt.util';

describe('Message Integration Tests', () => {
  let dataSource: DataSource;
  let messageService: MessageService;
  let messageRepo: Repository<MatchMessage>;
  let matchRepo: Repository<Match>;
  let matchPlayerRepo: Repository<MatchPlayer>;
  let systemParamRepo: Repository<SystemParam>;
  let playerRepo: Repository<Player>;
  let userRepo: Repository<User>;
  let venueRepo: Repository<Venue>;
  let formatRepo: Repository<Format>;
  let eventEmitter: EventEmitter;

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = 'vXloZBGTT7syeDNs5GBducYtkWxMuWifda6JljWUfHA=';
    process.env.PHONE_HASH_SECRET = 'test-phone-hash-secret-key-32bytes';

    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: 'basketball_platform_test',
      entities: [
        User,
        VenueManager,
        Player,
        PlayerPosition,
        Venue,
        VenueTimeSlot,
        Format,
        Intention,
        IntentionVenue,
        IntentionFormat,
        Match,
        MatchPlayer,
        MatchTeam,
        MatchMessage,
        Feedback,
        FeedbackPlayerRating,
        AdjustUpdateFailure,
        SystemParam,
      ],
      synchronize: true,
    });
    await dataSource.initialize();

    messageRepo = dataSource.getRepository(MatchMessage);
    matchRepo = dataSource.getRepository(Match);
    matchPlayerRepo = dataSource.getRepository(MatchPlayer);
    systemParamRepo = dataSource.getRepository(SystemParam);
    playerRepo = dataSource.getRepository(Player);
    userRepo = dataSource.getRepository(User);
    venueRepo = dataSource.getRepository(Venue);
    formatRepo = dataSource.getRepository(Format);
    eventEmitter = new EventEmitter();

    messageService = new MessageService(
      messageRepo,
      matchRepo,
      matchPlayerRepo,
      playerRepo,
      systemParamRepo,
      eventEmitter,
    );
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE feedback_player_ratings CASCADE');
    await dataSource.query('TRUNCATE TABLE feedbacks CASCADE');
    await dataSource.query('TRUNCATE TABLE match_messages CASCADE');
    await dataSource.query('TRUNCATE TABLE match_teams CASCADE');
    await dataSource.query('TRUNCATE TABLE match_players CASCADE');
    await dataSource.query('TRUNCATE TABLE matches CASCADE');
    await dataSource.query('TRUNCATE TABLE formats CASCADE');
    await dataSource.query('TRUNCATE TABLE intention_formats CASCADE');
    await dataSource.query('TRUNCATE TABLE intention_venues CASCADE');
    await dataSource.query('TRUNCATE TABLE intentions CASCADE');
    await dataSource.query('TRUNCATE TABLE venue_time_slots CASCADE');
    await dataSource.query('TRUNCATE TABLE venues CASCADE');
    await dataSource.query('TRUNCATE TABLE venue_managers CASCADE');
    await dataSource.query('TRUNCATE TABLE player_positions CASCADE');
    await dataSource.query('TRUNCATE TABLE players CASCADE');
    await dataSource.query('TRUNCATE TABLE users CASCADE');
    await dataSource.query('TRUNCATE TABLE system_params CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  function nextPhone(): string {
    const ts = Date.now();
    const rand = Math.floor(Math.random() * 10000);
    return `138${String(ts % 100000000).padStart(8, '0')}${String(rand).padStart(4, '0')}`.slice(0, 11);
  }

  async function createPlayer(): Promise<{ player: Player; user: User }> {
    const phone = nextPhone();
    const user = await userRepo.save({
      phone,
      phoneHash: hashForQuery(phone),
      passwordHash: 'hashed_password',
      nickname: 'TestPlayer',
      userType: 'player',
      status: 'active',
    });

    const player = await playerRepo.save({
      userId: user.id,
      age: 25,
      basketballAge: 5,
      gender: 'male',
      height: 180,
      baseAbilityScore: 50,
      matchAdjustValue: 0,
    });

    return { player, user };
  }

  async function createVenueAndFormat(): Promise<{ venue: Venue; format: Format }> {
    const phone = nextPhone();
    const user = await userRepo.save({
      phone,
      phoneHash: hashForQuery(phone),
      passwordHash: 'hashed_password',
      nickname: 'Manager',
      userType: 'venue_manager',
      status: 'active',
    });

    const vm = await dataSource.getRepository(VenueManager).save({
      userId: user.id,
      companyName: 'Test Co.',
      contactName: 'Manager',
      contactPhone: phone,
    });

    const venue = await venueRepo.save({
      managerId: vm.id,
      name: 'Test Venue',
      address: 'Test Address',
      pricePerHour: 200,
      courtCount: 2,
      regionCode: 'shenzhen_futian',
      status: 'active',
    });

    const format = await formatRepo.save({
      name: '3v3 Short',
      formatType: 'short',
      teamSize: 3,
      teamCountMin: 2,
      teamCountMax: 4,
      durationHours: 2,
      isActive: true,
    });

    return { venue, format };
  }

  async function createMatchWithPlayers(): Promise<{ match: Match; players: Player[]; users: User[] }> {
    const { venue, format } = await createVenueAndFormat();
    const match = await matchRepo.save({
      venueId: venue.id,
      formatId: format.id,
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
      status: 'confirmed',
      teamCount: 2,
      playersPerTeam: 3,
      totalPlayers: 6,
      depositAmount: '50.00',
      regionCode: 'shenzhen_futian',
    });

    const players: Player[] = [];
    const users: User[] = [];
    for (let i = 0; i < 3; i++) {
      const { player, user } = await createPlayer();
      players.push(player);
      users.push(user);
      await matchPlayerRepo.save({
        matchId: match.id,
        playerId: player.id,
        status: 'confirmed',
      });
    }

    return { match, players, users };
  }

  describe('MSG-INT-001: message send and receive', () => {
    it('should create message record when participant sends text', async () => {
      const { match, users } = await createMatchWithPlayers();

      const dto: SendMessageDto = {
        content: 'Hello team!',
        messageType: 'text',
      };

      const message = await messageService.sendMessage(match.id, users[0].id, dto);

      expect(message.id).toBeDefined();
      expect(message.content).toBe('Hello team!');
      expect(message.messageType).toBe('text');
      expect(message.matchId).toBe(match.id);
      expect(message.senderId).toBe(users[0].id);

      // Verify queryable by other participant
      const history = await messageService.getMessageHistory(match.id, users[1].id, {
        page: 1,
        pageSize: 10,
      });
      expect(history.list.length).toBe(1);
      expect(history.list[0].content).toBe('Hello team!');
    });
  });

  describe('MSG-INT-002: group chat expiry', () => {
    it('should reject messages after group chat expires', async () => {
      const { venue, format } = await createVenueAndFormat();
      // Create match from 10 days ago
      const match = await matchRepo.save({
        venueId: venue.id,
        formatId: format.id,
        startTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        status: 'confirmed',
        teamCount: 2,
        playersPerTeam: 3,
        totalPlayers: 6,
        depositAmount: '50.00',
        regionCode: 'shenzhen_futian',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      });

      const { player, user } = await createPlayer();
      await matchPlayerRepo.save({
        matchId: match.id,
        playerId: player.id,
        status: 'confirmed',
      });

      // Seed system param for 7-day expiry
      await systemParamRepo.save({
        paramKey: 'group_chat_expiry_days',
        paramValue: { expiry_days: 7 },
        description: 'Group chat expiry',
      });

      const dto: SendMessageDto = {
        content: 'This should fail',
        messageType: 'text',
      };

      await expect(
        messageService.sendMessage(match.id, user.id, dto),
      ).rejects.toThrow(/群聊已超过有效期/);
    });
  });

  describe('MSG-INT-003: non-participant restriction', () => {
    it('should reject messages from non-participants', async () => {
      const { match } = await createMatchWithPlayers();
      const { user: nonParticipant } = await createPlayer();

      const dto: SendMessageDto = {
        content: 'I am not in this match',
        messageType: 'text',
      };

      await expect(
        messageService.sendMessage(match.id, nonParticipant.id, dto),
      ).rejects.toThrow(/不是比赛.*参与者/);
    });
  });

  describe('MSG-INT-004: system message', () => {
    it('should create system message record', async () => {
      const { match } = await createMatchWithPlayers();

      const message = await messageService.sendSystemMessage(match.id, 'Match is starting soon!');

      expect(message.messageType).toBe('system');
      expect(message.senderId).toBeNull();
      expect(message.content).toBe('Match is starting soon!');
    });
  });
});
