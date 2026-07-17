import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { matchService } from '@/api/match.service';
import type { MatchDetailResponse } from '@/api/match.service';
import type { MatchDetailScreenNavigationProp, MatchDetailScreenRouteProp } from '@/navigation/types';
import { MATCH_STATUS_LABELS, MATCH_PLAYER_STATUS_LABELS } from '@shared/match';
import { MATCH_STATUS_COLORS, MATCH_PLAYER_STATUS_COLORS } from '@/constants/statusColors';

export function MatchDetailScreen() {
  const navigation = useNavigation<MatchDetailScreenNavigationProp>();
  const route = useRoute<MatchDetailScreenRouteProp>();
  const { matchId } = route.params;

  const [match, setMatch] = useState<MatchDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declineError, setDeclineError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMatch = useCallback(async () => {
    try {
      setError(null);
      const result = await matchService.getMatchDetail(matchId);
      setMatch(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [matchId]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadMatch();
    }, [loadMatch]),
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadMatch();
  }, [loadMatch]);

  const showSuccessToast = (message: string) => {
    setSuccessMessage(message);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setSuccessMessage(null), 2000);
  };

  const handleDecline = () => {
    const doDecline = async () => {
      try {
        setDeclineError(null);
        await matchService.declineParticipation(matchId);
        showSuccessToast('已拒绝参赛');
        loadMatch();
      } catch (err) {
        const message = err instanceof Error ? err.message : '操作失败';
        setDeclineError(message);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('确定要拒绝参加这场比赛吗？')) {
        doDecline();
      }
    } else {
      Alert.alert('确认拒绝', '确定要拒绝参加这场比赛吗？', [
        { text: '返回', style: 'cancel' },
        { text: '确定', style: 'destructive', onPress: doDecline },
      ]);
    }
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer} accessibilityLabel="加载中">
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setIsLoading(true);
            loadMatch();
          }}
          accessibilityLabel="重试"
        >
          <Text style={styles.retryButtonText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!match) return null;

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      {/* Success Toast */}
      {successMessage && (
        <View style={styles.successToast}>
          <Text style={styles.successToastText}>{successMessage}</Text>
        </View>
      )}

      {/* Status Badge */}
      <View style={styles.statusSection}>
        <View style={[styles.statusBadge, { backgroundColor: MATCH_STATUS_COLORS[match.status] }]}>
          <Text style={styles.statusText}>{MATCH_STATUS_LABELS[match.status]}</Text>
        </View>
      </View>

      {/* Match Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>比赛信息</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>开始时间</Text>
          <Text style={styles.infoValue}>{formatDateTime(match.startTime)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>结束时间</Text>
          <Text style={styles.infoValue}>{formatDateTime(match.endTime)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>场地</Text>
          <Text style={styles.infoValue}>{match.venueName || `场地${match.venueId}`}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>赛制</Text>
          <Text style={styles.infoValue}>{match.formatName || `赛制${match.formatId}`}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>保证金</Text>
          <Text style={styles.infoValue}>¥{match.depositAmount}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>参赛人数</Text>
          <Text style={styles.infoValue}>
            {match.confirmedPlayers}/{match.totalPlayers} 已确认
          </Text>
        </View>
        {match.status === 'cancelled' && match.cancelledReason && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>取消原因</Text>
            <Text style={[styles.infoValue, styles.cancelledReason]}>
              {match.cancelledReason}
            </Text>
          </View>
        )}
      </View>

      {/* Team Assignments */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>队伍分配</Text>
        {match.teams.map((team) => (
          <View key={team.teamNumber} style={styles.teamRow}>
            <Text style={styles.teamName}>{team.teamName || `队伍 ${team.teamNumber}`}</Text>
            <Text style={styles.teamAbility}>
              平均能力: {team.avgAbility ?? '-'}
            </Text>
          </View>
        ))}
      </View>

      {/* Players */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>参赛球员</Text>
        {match.players.map((player) => (
          <View key={player.playerId} style={styles.playerRow}>
            <Text style={styles.playerNickname}>{player.nickname || `球员${player.playerId}`}</Text>
            {player.teamNumber != null && (
              <Text style={styles.playerTeam}>队伍{player.teamNumber}</Text>
            )}
            <View
              style={[
                styles.playerStatusBadge,
                { backgroundColor: MATCH_PLAYER_STATUS_COLORS[player.status] },
              ]}
            >
              <Text style={styles.playerStatusText}>
                {MATCH_PLAYER_STATUS_LABELS[player.status]}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Decline Error */}
      {declineError && <Text style={styles.errorMsgText}>{declineError}</Text>}

      {/* Action Buttons (only for invited) */}
      {match.playerStatus === 'invited' && (
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() =>
              navigation.navigate('ConfirmMatch', {
                matchId: match.id,
                depositAmount: match.depositAmount,
              })
            }
            accessibilityLabel="确认参赛"
            accessibilityRole="button"
          >
            <Text style={styles.confirmButtonText}>确认参赛</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.declineButton}
            onPress={handleDecline}
            accessibilityLabel="拒绝参赛"
            accessibilityRole="button"
          >
            <Text style={styles.declineButtonText}>拒绝参赛</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Chat Button (only when groupChatId exists) */}
      {match.groupChatId && (
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() =>
            navigation.navigate('Chat', {
              matchId: match.id,
              matchTitle: `${match.venueName || '比赛'} - ${match.formatName || ''}`,
            })
          }
          accessibilityLabel="进入群聊"
          accessibilityRole="button"
        >
          <Text style={styles.chatButtonText}>进入群聊</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorText: {
    fontSize: 14,
    color: '#e74c3c',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#3498db',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  successToast: {
    backgroundColor: '#27ae60',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  successToastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.05)',
    elevation: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 14,
    color: '#999',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  teamAbility: {
    fontSize: 13,
    color: '#666',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 8,
  },
  playerNickname: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  playerTeam: {
    fontSize: 12,
    color: '#666',
  },
  playerStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  playerStatusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  errorMsgText: {
    fontSize: 14,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 12,
  },
  actionSection: {
    marginTop: 16,
    gap: 12,
  },
  confirmButton: {
    backgroundColor: '#27ae60',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  declineButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  chatButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelledReason: {
    color: '#e74c3c',
  },
});
