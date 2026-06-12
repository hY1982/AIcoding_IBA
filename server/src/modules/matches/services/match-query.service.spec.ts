import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MatchQueryService } from './match-query.service';
import { Match } from '../entities/match.entity';
import { MatchPlayer } from '../entities/match-player.entity';
import { MatchTeam } from '../entities/match-team.entity';

describe('MatchQueryService', () => {
  let service: MatchQueryService;
  let mockMatchRepo: any;
  let mockMatchPlayerRepo: any;
  let mockMatchTeamRepo: any;

  function createMockQueryBuilder() {
    const qb: any = {};
    const methods = [
      'innerJoin', 'leftJoin', 'addSelect', 'where', 'andWhere',
      'orderBy', 'offset', 'limit',
    ];
    methods.forEach((m) => {
      qb[m] = jest.fn().mockReturnValue(qb);
    });
    qb.getCount = jest.fn().mockResolvedValue(0);
    qb.getRawMany = jest.fn().mockResolvedValue([]);
    qb.getOne = jest.fn().mockResolvedValue(null);
    qb.getRawOne = jest.fn().mockResolvedValue(null);
    return qb;
  }

  let countQb: ReturnType<typeof createMockQueryBuilder>;
  let dataQb: ReturnType<typeof createMockQueryBuilder>;

  beforeEach(async () => {
    countQb = createMockQueryBuilder();
    dataQb = createMockQueryBuilder();

    let callCount = 0;
    mockMatchRepo = {
      createQueryBuilder: jest.fn().mockImplementation(() => {
        callCount++;
        // First call is count, second is data
        return callCount === 1 ? countQb : dataQb;
      }),
    };
    mockMatchPlayerRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(createMockQueryBuilder()),
    };
    mockMatchTeamRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchQueryService,
        { provide: getRepositoryToken(Match), useValue: mockMatchRepo },
        { provide: getRepositoryToken(MatchPlayer), useValue: mockMatchPlayerRepo },
        { provide: getRepositoryToken(MatchTeam), useValue: mockMatchTeamRepo },
      ],
    }).compile();

    service = module.get<MatchQueryService>(MatchQueryService);
  });

  describe('findMyMatches', () => {
    it('should return paginated match list for a player', async () => {
      countQb.getCount.mockResolvedValue(1);
      dataQb.getRawMany.mockResolvedValue([
        {
          match_id: '1',
          match_venue_id: '10',
          match_format_id: '5',
          match_start_time: new Date('2026-06-15T14:00:00Z'),
          match_end_time: new Date('2026-06-15T16:00:00Z'),
          match_status: 'pending_confirmation',
          match_team_count: 3,
          match_players_per_team: 3,
          match_total_players: 9,
          match_confirmed_players: 0,
          match_deposit_amount: '50.00',
          match_region_code: 'shenzhen_futian',
          match_created_at: new Date(),
          match_updated_at: new Date(),
          venue_name: 'Test Court',
          format_name: '3v3 Short',
          mp_status: 'invited',
          mp_team_number: 1,
        },
      ]);

      const result = await service.findMyMatches(42, { page: 1, pageSize: 10 });

      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('pageSize', 10);
      expect(result).toHaveProperty('total', 1);
      expect(result.list).toHaveLength(1);
      expect(result.list[0]).toHaveProperty('id', 1);
      expect(result.list[0]).toHaveProperty('venueName', 'Test Court');
      expect(result.list[0]).toHaveProperty('playerStatus', 'invited');
      expect(result.list[0]).toHaveProperty('teamNumber', 1);
    });

    it('should filter by status when provided', async () => {
      countQb.getCount.mockResolvedValue(0);
      dataQb.getRawMany.mockResolvedValue([]);

      await service.findMyMatches(42, { page: 1, pageSize: 10, status: 'confirmed' });

      // Both count and data QBs should have andWhere called with status filter
      expect(countQb.andWhere).toHaveBeenCalledWith(
        'match.status = :status',
        { status: 'confirmed' },
      );
      expect(dataQb.andWhere).toHaveBeenCalledWith(
        'match.status = :status',
        { status: 'confirmed' },
      );
    });

    it('should return empty list when no matches found', async () => {
      countQb.getCount.mockResolvedValue(0);
      dataQb.getRawMany.mockResolvedValue([]);

      const result = await service.findMyMatches(42, { page: 1, pageSize: 10 });

      expect(result.page).toBe(1);
      expect(result.total).toBe(0);
      expect(result.list).toHaveLength(0);
    });
  });

  describe('findMatchDetail', () => {
    const detailQb = createMockQueryBuilder();

    beforeEach(() => {
      // Override createQueryBuilder for detail queries — all return detailQb
      mockMatchRepo.createQueryBuilder.mockReturnValue(detailQb);
      // Player repo QB for players list
      const playerQb = createMockQueryBuilder();
      playerQb.getRawMany.mockResolvedValue([
        { mp_player_id: '42', u_nickname: 'Player1', mp_team_number: 1, mp_status: 'invited', mp_is_reserve: false },
      ]);
      mockMatchPlayerRepo.createQueryBuilder.mockReturnValue(playerQb);
    });

    it('should return match detail for a participant', async () => {
      mockMatchPlayerRepo.findOne.mockResolvedValue({
        matchId: 1, playerId: 42, status: 'invited', teamNumber: 1,
      });

      detailQb.getRawOne.mockResolvedValue({
        match_id: '1', match_venue_id: '10', match_format_id: '5',
        match_start_time: new Date('2026-06-15T14:00:00Z'),
        match_end_time: new Date('2026-06-15T16:00:00Z'),
        match_status: 'pending_confirmation',
        match_team_count: 3, match_players_per_team: 3, match_total_players: 9,
        match_confirmed_players: 0, match_deposit_amount: '50.00',
        match_region_code: 'shenzhen_futian', match_group_chat_id: null,
        match_created_at: new Date(), match_updated_at: new Date(),
        venue_name: 'Test Court', format_name: '3v3 Short',
      });

      mockMatchTeamRepo.find.mockResolvedValue([
        { teamNumber: 1, teamName: 'Team 1', avgAbility: 55.0 },
        { teamNumber: 2, teamName: 'Team 2', avgAbility: null },
      ]);

      const result = await service.findMatchDetail(1, 42);

      expect(result.id).toBe(1);
      expect(result.venueName).toBe('Test Court');
      expect(result.playerStatus).toBe('invited');
      expect(result.teamNumber).toBe(1);
      expect(result.teams).toHaveLength(2);
      expect(result.players).toHaveLength(1);
      expect(result.players[0].nickname).toBe('Player1');
      expect(result.groupChatId).toBeNull();
    });

    it('should throw NotFoundException when player is not a participant', async () => {
      mockMatchPlayerRepo.findOne.mockResolvedValue(null);

      await expect(service.findMatchDetail(1, 999)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when match does not exist', async () => {
      mockMatchPlayerRepo.findOne.mockResolvedValue({
        matchId: 1, playerId: 42, status: 'invited', teamNumber: null,
      });
      detailQb.getRawOne.mockResolvedValue(null);

      await expect(service.findMatchDetail(1, 42)).rejects.toThrow(NotFoundException);
    });
  });
});
