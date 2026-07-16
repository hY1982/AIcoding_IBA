import type { MatchStatus, MatchPlayerStatus } from '@shared/match';

export const MATCH_STATUS_COLORS: Record<MatchStatus, string> = {
  pending_players: '#f39c12',
  pending_venue: '#3498db',
  confirmed: '#27ae60',
  in_progress: '#2ecc71',
  completed: '#7f8c8d',
  cancelled: '#95a5a6',
  expired: '#e74c3c',
};

export const MATCH_PLAYER_STATUS_COLORS: Record<MatchPlayerStatus, string> = {
  invited: '#f39c12',
  confirmed: '#27ae60',
  withdrawn: '#e74c3c',
  no_show: '#95a5a6',
};
