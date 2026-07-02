/**
 * Default seed data for basketball match formats.
 * These records are inserted via the SeedFormats migration.
 *
 * All entries are "short" format games (短赛) as defined in the MVP scope.
 * Long format games (长赛) can be added later via new migrations.
 */
export const DEFAULT_FORMATS = [
  {
    name: '3v3短赛',
    formatType: 'short' as const,
    teamSize: 3,
    teamCountMin: 2,  // 最低2队 = 6人
    teamCountMax: 4,  // 满员4队 = 12人
    winCondition: '先进5球或11分',
    durationHours: 1.5,
    description: '3对3短赛，先进5球或先得11分者胜',
  },
  {
    name: '4v4短赛',
    formatType: 'short' as const,
    teamSize: 4,
    teamCountMin: 2,  // 最低2队 = 8人
    teamCountMax: 4,  // 满员4队 = 16人
    winCondition: '先进5球或11分',
    durationHours: 2.0,
    description: '4对4短赛，先进5球或先得11分者胜',
  },
  {
    name: '5v5短赛',
    formatType: 'short' as const,
    teamSize: 5,
    teamCountMin: 2,  // 最低2队 = 10人
    teamCountMax: 4,  // 满员4队 = 20人
    winCondition: '先进5球或11分',
    durationHours: 2.5,
    description: '5对5短赛，先进5球或先得11分者胜',
  },
];
