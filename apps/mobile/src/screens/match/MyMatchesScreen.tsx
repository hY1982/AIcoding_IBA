import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { matchService } from '@/api/match.service';
import type { MatchListResponse } from '@/api/match.service';
import type { MyMatchesScreenNavigationProp } from '@/navigation/types';
import { MATCH_STATUS_LABELS, MatchStatus } from '@shared/match';
import { MATCH_STATUS_COLORS, MATCH_PLAYER_STATUS_COLORS } from '@/constants/statusColors';
import { MATCH_PLAYER_STATUS_LABELS } from '@shared/match';

const DEFAULT_PAGE_SIZE = 10;

type FilterStatus = MatchStatus | 'all';

const STATUS_FILTERS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending_confirmation', label: '等待确认' },
  { key: 'confirmed', label: '已确认' },
  { key: 'in_progress', label: '进行中' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' },
  { key: 'failed', label: '匹配失败' },
];

// Dynamic empty state text per filter
const EMPTY_STATE_TEXT: Record<FilterStatus, string> = {
  all: '暂无比赛',
  pending_confirmation: '暂无待确认的比赛',
  confirmed: '暂无已确认的比赛',
  in_progress: '暂无进行中的比赛',
  completed: '暂无已完成的比赛',
  cancelled: '暂无已取消的比赛',
  failed: '暂无匹配失败的比赛',
};

export function MyMatchesScreen() {
  const navigation = useNavigation<MyMatchesScreenNavigationProp>();

  const [matches, setMatches] = useState<MatchListResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');

  const loadMatches = useCallback(
    async (targetPage: number, isRefresh = false, status?: FilterStatus) => {
      try {
        setError(null);
        const filterStatus = status ?? activeFilter;
        const params: { page: number; pageSize: number; status?: MatchStatus } = {
          page: targetPage,
          pageSize: DEFAULT_PAGE_SIZE,
        };
        if (filterStatus !== 'all') {
          params.status = filterStatus;
        }

        const response = await matchService.getMyMatches(params);

        if (isRefresh || targetPage === 1) {
          setMatches(response.list);
        } else {
          setMatches((prev) => [...prev, ...response.list]);
        }

        setHasMore(response.total > targetPage * DEFAULT_PAGE_SIZE);
        setPage(targetPage);
      } catch (err) {
        const message = err instanceof Error ? err.message : '加载失败';
        setError(message);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [activeFilter],
  );

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadMatches(1, true);
    }, [loadMatches]),
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadMatches(1, true);
  }, [loadMatches]);

  const onLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      setIsLoadingMore(true);
      loadMatches(page + 1);
    }
  }, [isLoadingMore, hasMore, page, loadMatches]);

  const onFilterChange = useCallback(
    (filter: FilterStatus) => {
      setActiveFilter(filter);
      setIsLoading(true);
      setMatches([]);
      loadMatches(1, true, filter);
    },
    [loadMatches],
  );

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  };

  const renderFilterTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterContainer}
      contentContainerStyle={styles.filterContent}
    >
      {STATUS_FILTERS.map((filter) => (
        <TouchableOpacity
          key={filter.key}
          style={[styles.filterTab, activeFilter === filter.key && styles.filterTabActive]}
          onPress={() => onFilterChange(filter.key)}
          accessibilityLabel={`筛选${filter.label}`}
        >
          <Text
            style={[styles.filterTabText, activeFilter === filter.key && styles.filterTabTextActive]}
          >
            {filter.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderMatchItem = ({ item }: { item: MatchListResponse }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
      accessibilityLabel={`比赛卡片-${item.id}`}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.timeText}>
          {formatTime(item.startTime)} - {formatTime(item.endTime)}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: MATCH_STATUS_COLORS[item.status] }]}>
          <Text style={styles.statusText}>{MATCH_STATUS_LABELS[item.status]}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.infoLabel}>场地：</Text>
        <Text style={styles.infoValue}>{item.venueName || `场地${item.venueId}`}</Text>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.infoLabel}>赛制：</Text>
        <Text style={styles.infoValue}>{item.formatName || `赛制${item.formatId}`}</Text>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.infoLabel}>人数：</Text>
        <Text style={styles.infoValue}>
          {item.confirmedPlayers}/{item.totalPlayers} 已确认
        </Text>
        <Text style={styles.infoLabel}>  保证金：</Text>
        <Text style={styles.infoValue}>¥{item.depositAmount}</Text>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.infoLabel}>我的状态：</Text>
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
  );

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#3498db" />
        <Text style={styles.footerText}>加载中...</Text>
      </View>
    );
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
            loadMatches(1, true);
          }}
          accessibilityLabel="重试"
        >
          <Text style={styles.retryButtonText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (matches.length === 0) {
    return (
      <View style={styles.container}>
        {renderFilterTabs()}
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>{EMPTY_STATE_TEXT[activeFilter]}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderFilterTabs()}
      <FlatList
        data={matches}
        renderItem={renderMatchItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        windowSize={10}
        initialNumToRender={8}
        accessibilityLabel="比赛列表"
      />
    </View>
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
  },
  filterContainer: {
    maxHeight: 48,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  filterTabActive: {
    backgroundColor: '#1a73e8',
  },
  filterTabText: {
    fontSize: 13,
    color: '#666',
  },
  filterTabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContainer: {
    padding: 12,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: '#999',
  },
  infoValue: {
    fontSize: 13,
    color: '#333',
    flex: 1,
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
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  footerText: {
    fontSize: 13,
    color: '#999',
  },
});
