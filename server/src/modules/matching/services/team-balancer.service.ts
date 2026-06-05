import { Injectable, BadRequestException } from '@nestjs/common';
import { Player } from '@modules/players/entities/player.entity';
import { Format } from '@modules/formats/entities/format.entity';

/**
 * 队伍分配结果
 */
export interface TeamAssignment {
  teamNumber: number;
  teamName?: string;
  players: Array<Pick<Player, 'id' | 'totalAbilityScore'>>;
  avgAbility: number;
}

/**
 * 分队算法输入
 */
export interface BalancerInput {
  players: Array<Pick<Player, 'id' | 'totalAbilityScore'>>;
  format: Pick<Format, 'teamSize' | 'teamCountMin' | 'teamCountMax'>;
}

/**
 * 蛇形选秀分队服务
 *
 * 使用蛇形选秀（Snake Draft）算法将球员均衡分配到各支队伍。
 * 算法原理：
 * 1. 将球员按能力值降序排序
 * 2. 第1轮正向分配：队伍1选最强，队伍2选次强...
 * 3. 第2轮反向分配：队伍N选第N+1强，队伍N-1选第N+2强...
 * 4. 重复直到所有球员分配完毕
 *
 * 此算法确保每支队伍获得的"选秀权"总和相等，能力值分布最均衡。
 */
@Injectable()
export class TeamBalancerService {
  /**
   * 蛇形选秀分队算法
   *
   * @param input 球员列表和赛制信息
   * @returns 队伍分配结果
   * @throws BadRequestException 人数不足以组成最低队伍数时
   */
  snakeDraft(input: BalancerInput): TeamAssignment[] {
    const { players, format } = input;
    const playerCount = players.length;

    // 计算可行的队伍数
    const maxPossibleTeams = Math.floor(playerCount / format.teamSize);

    // 人数不足以组成最低队伍数时抛出异常
    if (maxPossibleTeams < format.teamCountMin) {
      throw new BadRequestException(
        `球员人数 ${playerCount} 不足以组成最低 ${format.teamCountMin} 支队伍（每队${format.teamSize}人）`,
      );
    }

    const teamCount = Math.min(
      Math.max(maxPossibleTeams, format.teamCountMin),
      format.teamCountMax,
    );

    // 按能力值降序排序（同分按id升序保证确定性）
    const sorted = [...players].sort((a, b) => {
      const diff = b.totalAbilityScore - a.totalAbilityScore;
      return diff !== 0 ? diff : a.id - b.id;
    });

    // 初始化队伍
    const teams: TeamAssignment[] = Array.from(
      { length: teamCount },
      (_, i) => ({
        teamNumber: i + 1,
        teamName: `队伍${i + 1}`,
        players: [],
        avgAbility: 0,
      }),
    );

    // 蛇形分配
    let teamIndex = 0;
    let direction = 1; // 1 = 正向, -1 = 反向

    for (const player of sorted) {
      teams[teamIndex].players.push(player);

      // 更新队伍索引（蛇形）
      if (direction === 1) {
        teamIndex++;
        if (teamIndex >= teamCount) {
          teamIndex = teamCount - 1;
          direction = -1;
        }
      } else {
        teamIndex--;
        if (teamIndex < 0) {
          teamIndex = 0;
          direction = 1;
        }
      }
    }

    // 计算每队平均能力值
    for (const team of teams) {
      const sum = team.players.reduce((acc, p) => acc + p.totalAbilityScore, 0);
      team.avgAbility =
        team.players.length > 0
          ? Math.round((sum / team.players.length) * 100) / 100
          : 0;
    }

    return teams;
  }

  /**
   * 计算分队均衡性指标（标准差）
   *
   * 返回各队平均能力值的标准差，越小表示分队越均衡。
   *
   * @param teams 队伍分配结果
   * @returns 标准差
   */
  calculateBalanceScore(teams: TeamAssignment[]): number {
    const avgScores = teams.map((t) => t.avgAbility);
    const mean = avgScores.reduce((a, b) => a + b, 0) / avgScores.length;
    const variance =
      avgScores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) /
      avgScores.length;
    return Math.sqrt(variance);
  }
}
