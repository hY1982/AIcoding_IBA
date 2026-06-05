/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { DataSource } from 'typeorm';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { MatchTeam } from '@modules/matches/entities/match-team.entity';
import { MatchMessage } from './match-message.entity';
import { User } from '@modules/users/entities/user.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { Player } from '@modules/players/entities/player.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { IntentionVenue } from '@modules/intentions/entities/intention-venue.entity';
import { IntentionFormat } from '@modules/intentions/entities/intention-format.entity';
import {
  createTestMatch,
  createTestPlayer,
  createTestMatchMessage,
} from '../../../../test/factories/match.factory';

describe('MatchMessage Entity', () => {
  let dataSource: DataSource;

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
      ],
      synchronize: true,
    });
    await dataSource.initialize();
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE match_messages CASCADE');
    await dataSource.query('TRUNCATE TABLE match_teams CASCADE');
    await dataSource.query('TRUNCATE TABLE match_players CASCADE');
    await dataSource.query('TRUNCATE TABLE matches CASCADE');
    await dataSource.query('TRUNCATE TABLE formats CASCADE');
    await dataSource.query('TRUNCATE TABLE venues CASCADE');
    await dataSource.query('TRUNCATE TABLE players CASCADE');
    await dataSource.query('TRUNCATE TABLE venue_managers CASCADE');
    await dataSource.query('TRUNCATE TABLE users CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  describe('table structure', () => {
    it('should create match_messages table with correct columns', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'match_messages'
         ORDER BY ordinal_position`,
      );

      const columnNames = columns.map(
        (c: { column_name: string }) => c.column_name,
      );
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('match_id');
      expect(columnNames).toContain('sender_id');
      expect(columnNames).toContain('content');
      expect(columnNames).toContain('message_type');
      expect(columnNames).toContain('created_at');
    });

    it('should have match_id as non-nullable bigint and sender_id as nullable bigint', async () => {
      const matchIdColumns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'match_messages' AND column_name = 'match_id'`,
      );
      expect(matchIdColumns.length).toBe(1);
      expect(matchIdColumns[0].data_type).toBe('bigint');
      expect(matchIdColumns[0].is_nullable).toBe('NO');

      const senderIdColumns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'match_messages' AND column_name = 'sender_id'`,
      );
      expect(senderIdColumns.length).toBe(1);
      expect(senderIdColumns[0].data_type).toBe('bigint');
      expect(senderIdColumns[0].is_nullable).toBe('YES');
    });

    it('should have content as text non-nullable', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = 'match_messages' AND column_name = 'content'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('text');
      expect(columns[0].is_nullable).toBe('NO');
    });

    it('should have message_type as enum default text', async () => {
      const columns = await dataSource.query(
        `SELECT column_name, data_type, is_nullable, column_default, udt_name
         FROM information_schema.columns
         WHERE table_name = 'match_messages' AND column_name = 'message_type'`,
      );
      expect(columns.length).toBe(1);
      expect(columns[0].data_type).toBe('USER-DEFINED');
      expect(columns[0].udt_name).toBe('match_messages_message_type_enum');
      expect(columns[0].is_nullable).toBe('NO');
      expect(columns[0].column_default).toContain('text');
    });

    it('should have index on match_id and created_at', async () => {
      const indexes = await dataSource.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'match_messages'`,
      );
      const matchIndex = indexes.find((i: { indexdef: string }) =>
        i.indexdef.includes('(match_id, created_at)'),
      );
      expect(matchIndex).toBeDefined();
    });
  });

  describe('entity creation', () => {
    it('should create a message', async () => {
      const match = await createTestMatch(dataSource);
      const player = await createTestPlayer(dataSource);

      const msg = await createTestMatchMessage(
        dataSource,
        match.id,
        player.userId,
        {
          content: "Let's play!",
          messageType: 'text',
        },
      );

      expect(msg.id).toBeDefined();
      expect(msg.matchId).toBe(match.id);
      expect(msg.senderId).toBe(player.userId);
      expect(msg.content).toBe("Let's play!");
      expect(msg.messageType).toBe('text');
      expect(msg.createdAt).toBeInstanceOf(Date);
    });

    it('should default message_type to text', async () => {
      const match = await createTestMatch(dataSource);
      const player = await createTestPlayer(dataSource);

      const msg = await createTestMatchMessage(
        dataSource,
        match.id,
        player.userId,
        { content: 'Default type test' },
      );

      expect(msg.messageType).toBe('text');
    });

    it('should reject invalid message_type', async () => {
      const match = await createTestMatch(dataSource);
      const player = await createTestPlayer(dataSource);
      const msgRepo = dataSource.getRepository(MatchMessage);

      const invalidMsg = msgRepo.create({
        matchId: match.id,
        senderId: player.userId,
        content: 'Test',
        messageType: 'invalid_type' as 'text',
      });

      await expect(msgRepo.save(invalidMsg)).rejects.toThrow();
    });

    it('should cascade delete when match deleted', async () => {
      const match = await createTestMatch(dataSource);
      const player = await createTestPlayer(dataSource);
      const message = await createTestMatchMessage(
        dataSource,
        match.id,
        player.userId,
      );

      const matchRepo = dataSource.getRepository(Match);
      await matchRepo.remove(match);

      const msgRepo = dataSource.getRepository(MatchMessage);
      const found = await msgRepo.findOne({ where: { id: message.id } });
      expect(found).toBeNull();
    });
  });
});
