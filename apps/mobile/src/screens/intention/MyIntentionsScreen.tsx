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
import { intentionService } from '@/api/intention.service';
import type { IntentionResponse } from '@/api/intention.service';
import type { MyIntentionsScreenNavigationProp } from '@/navigation/types';
import { INTENTION_STATUS_LABELS, IntentionStatus } from '@shared/intention';
import { INTENTION_STATUS_COLORS } from '@/constants/intentionStatus';

const DEFAULT_PAGE_SIZE = 10;

type FilterStatus = IntentionStatus | 'all';

const STATUS_FILTERS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '等待匹配' },
  { key: 'confirmed', label: '已确认' },
  { key: 'cancelled', label: '已取消' },
  { key: 'expired', label: '已过期' },
];

export function MyIntentionsScreen() {
  const navigation = useNavigation<MyIntentionsScreenNavigationProp>();

  const [intentions, setIntentions] = useState<IntentionResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');

  const loadIntentions = useCallback(
    async (targetPage: number, isRefresh = false, status?: FilterStatus) => {
      try {
        setError(null);
        const filterStatus = status ?? activeFilter;
        const params: { page: number; pageSize: number; status?: IntentionStatus } = {
          page: targetPage,
          pageSize: DEFAULT_PAGE_SIZE,
        };
        if (filterStatus !== 'all') {
          params.status = filterStatus;
        }

        const response = await intentionService.getMyIntentions(params);

        if (isRefresh || targetPage === 1) {
          setIntentions(response.list);
        } else {
          setIntentions((prev) => [...prev, ...response.list]);
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
      loadIntentions(1, true);
    }, [loadIntentions]),
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadIntentions(1, true);
  }, [loadIntentions]);

  const onLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      setIsLoadingMore(true);
      loadIntentions(page + 1);
    }
  }, [isLoadingMore, hasMore, page, loadIntentions]);

  const onFilterChange = useCallback(
    (filter: FilterStatus) => {
      setActiveFilter(filter);
      setIsLoading(true);
      setIntentions([]);
      loadIntentions(1, true, filter);
    },
    [loadIntentions],
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

  const renderIntentionItem = ({ item }: { item: IntentionResponse }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('IntentionDetail', { intentionId: item.id })}
      accessibilityLabel={`意向卡片-${item.id}`}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.timeText}>
          {formatTime(item.startTime)} - {formatTime(item.endTime)}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: INTENTION_STATUS_COLORS[item.status] }]}>
          <Text style={styles.statusText}>{INTENTION_STATUS_LABELS[item.status]}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.infoLabel}>场地：</Text>
        <Text style={styles.infoValue}>
          {item.venues.map((v) => v.venueName || `场地${v.venueId}`).join('、')}
        </Text>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.infoLabel}>赛制：</Text>
        <Text style={styles.infoValue}>
          {item.formats.map((f) => f.formatName || `赛制${f.formatId}`).join('、')}
        </Text>
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
            loadIntentions(1, true);
          }}
          accessibilityLabel="重试"
        >
          <Text style={styles.retryButtonText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (intentions.length === 0) {
    return (
      <View style={styles.container}>
        {renderFilterTabs()}
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>暂无意向</Text>
        </View>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('CreateIntention')}
          accessibilityLabel="发布意向"
        >
          <Text style={styles.fabText}>+ 发布意向</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderFilterTabs()}
      <FlatList
        data={intentions}
        renderItem={renderIntentionItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        windowSize={10}
        initialNumToRender={8}
        accessibilityLabel="意向列表"
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateIntention')}
        accessibilityLabel="发布意向"
      >
        <Text style={styles.fabText}>+ 发布意向</Text>
      </TouchableOpacity>
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#1a73e8',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.15)',
    elevation: 6,
  },
  fabText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
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
