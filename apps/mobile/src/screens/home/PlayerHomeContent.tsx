import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAppStore } from '@/stores';
import { intentionService } from '@/api/intention.service';
import { matchService } from '@/api/match.service';
import type { IntentionResponse } from '@/api/intention.service';
import type { MatchListResponse } from '@/api/match.service';
import type { HomeStackNavigationProp, PlayerTabNavigationProp } from '@/navigation/types';
import { INTENTION_STATUS_LABELS } from '@shared/intention';
import { INTENTION_STATUS_COLORS } from '@/constants/intentionStatus';
import { MATCH_STATUS_LABELS, MATCH_PLAYER_STATUS_LABELS } from '@shared/match';
import { MATCH_STATUS_COLORS, MATCH_PLAYER_STATUS_COLORS } from '@/constants/statusColors';

export function PlayerHomeContent() {
  const navigation = useNavigation<HomeStackNavigationProp>();
  const tabNavigation = useNavigation<PlayerTabNavigationProp>();
  const user = useAppStore((state) => state.user);

  const [intentions, setIntentions] = useState<IntentionResponse[]>([]);
  const [matches, setMatches] = useState<MatchListResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [intentionsRes, matchesRes] = await Promise.all([
        intentionService.getMyIntentions({ page: 1, pageSize: 3 }),
        matchService.getMyMatches({ page: 1, pageSize: 3 }),
      ]);
      setIntentions(intentionsRes.list);
      setMatches(matchesRes.list);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      setError(message);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setError(null);
    loadData();
  }, [loadData]);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
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
        <TouchableOpacity style={styles.retryButton} onPress={onRefresh} accessibilityLabel="重试">
          <Text style={styles.retryButtonText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Welcome Header */}
      <View style={styles.header}>
        <Text style={styles.welcomeText}>欢迎回来，{user?.nickname}</Text>
        <Text style={styles.subtitle}>球员首页</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('CreateIntention', undefined)}
          accessibilityLabel="发布意向"
          accessibilityRole="button"
        >
          <Text style={styles.actionButtonText}>发布意向</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => navigation.navigate('VenueList')}
          accessibilityLabel="浏览场地"
          accessibilityRole="button"
        >
          <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>浏览场地</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.tertiaryButton]}
          onPress={() => tabNavigation.navigate('MatchesTab')}
          accessibilityLabel="我的比赛"
          accessibilityRole="button"
        >
          <Text style={[styles.actionButtonText, styles.tertiaryButtonText]}>我的比赛</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Intentions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>最近意向</Text>
        {intentions.length === 0 ? (
          <Text style={styles.emptyText}>暂无意向，点击发布意向开始</Text>
        ) : (
          intentions.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => navigation.navigate('IntentionDetail', { intentionId: item.id })}
              accessibilityLabel={`意向卡片-${item.id}`}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTime}>{formatTime(item.startTime)}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: INTENTION_STATUS_COLORS[item.status] },
                  ]}
                >
                  <Text style={styles.statusText}>{INTENTION_STATUS_LABELS[item.status]}</Text>
                </View>
              </View>
              <Text style={styles.cardInfo}>
                时长: {item.durationMinutes}分钟 | 场地: {item.venues[0]?.venueName || '未指定'}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Recent Matches */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>最近比赛</Text>
        {matches.length === 0 ? (
          <Text style={styles.emptyText}>暂无比赛</Text>
        ) : (
          matches.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
              accessibilityLabel={`比赛卡片-${item.id}`}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTime}>
                  {formatTime(item.startTime)} - {formatTime(item.endTime)}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: MATCH_STATUS_COLORS[item.status] },
                  ]}
                >
                  <Text style={styles.statusText}>{MATCH_STATUS_LABELS[item.status]}</Text>
                </View>
              </View>
              <Text style={styles.cardInfo}>
                场地: {item.venueName || `场地${item.venueId}`} | 赛制:{' '}
                {item.formatName || `赛制${item.formatId}`}
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.cardInfo}>
                  {item.confirmedPlayers}/{item.totalPlayers} 已确认
                </Text>
                <View
                  style={[
                    styles.playerStatusBadge,
                    { backgroundColor: MATCH_PLAYER_STATUS_COLORS[item.playerStatus] },
                  ]}
                >
                  <Text style={styles.playerStatusText}>
                    {MATCH_PLAYER_STATUS_LABELS[item.playerStatus]}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
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
  header: {
    backgroundColor: '#fff',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#3498db',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#3498db',
  },
  tertiaryButton: {
    backgroundColor: '#9b59b6',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#3498db',
  },
  tertiaryButtonText: {
    color: '#fff',
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 16,
  },
  card: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  cardInfo: {
    fontSize: 13,
    color: '#666',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
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
});
