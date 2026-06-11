import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { venueService } from '@/api/venue.service';
import type { VenueListItem } from '@shared/venue';
import { FLOOR_MATERIAL_LABELS, COURT_TYPE_LABELS } from '@shared/venue';
import type { VenueListScreenNavigationProp } from '@/navigation/types';

const DEFAULT_PAGE_SIZE = 10;

export function VenueListScreen() {
  const navigation = useNavigation<VenueListScreenNavigationProp>();

  const [venues, setVenues] = useState<VenueListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadVenues = useCallback(async (targetPage: number, isRefresh = false) => {
    try {
      setError(null);
      const response = await venueService.getVenues({
        page: targetPage,
        pageSize: DEFAULT_PAGE_SIZE,
      });

      if (isRefresh) {
        setVenues(response.list);
      } else {
        setVenues((prev) => (targetPage === 1 ? response.list : [...prev, ...response.list]));
      }

      setHasMore(
        response.list.length === DEFAULT_PAGE_SIZE &&
          response.total > targetPage * DEFAULT_PAGE_SIZE,
      );
      setPage(targetPage);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadVenues(1, true);
  }, [loadVenues]);

  const onLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      setIsLoadingMore(true);
      loadVenues(page + 1);
    }
  }, [isLoadingMore, hasMore, page, loadVenues]);

  useEffect(() => {
    loadVenues(1, true);
  }, [loadVenues]);

  const handleVenuePress = (venueId: number) => {
    navigation.navigate('VenueDetail', { venueId });
  };

  const renderFacilityTags = (venue: VenueListItem) => {
    const tags: { label: string; active: boolean }[] = [];

    if (venue.courtType) {
      tags.push({ label: COURT_TYPE_LABELS[venue.courtType], active: true });
    }
    if (venue.floorMaterial) {
      tags.push({ label: FLOOR_MATERIAL_LABELS[venue.floorMaterial], active: true });
    }
    if (venue.airCondition) tags.push({ label: '空调', active: true });
    if (venue.ventilation) tags.push({ label: '通风', active: true });
    if (venue.parking) tags.push({ label: '停车', active: true });
    if (venue.shower) tags.push({ label: '淋浴', active: true });
    if (venue.restroom) tags.push({ label: '洗手间', active: true });
    if (venue.lockerRoom) tags.push({ label: '更衣室', active: true });

    return (
      <View style={styles.tagContainer} accessibilityLabel={`${venue.name}设施标签`}>
        {tags.map((tag, index) => (
          <View key={index} style={styles.tag}>
            <Text style={styles.tagText}>{tag.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderVenueItem = ({ item }: { item: VenueListItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleVenuePress(item.id)}
      accessibilityLabel={`场地卡片-${item.id}`}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.venueName}>{item.name}</Text>
        {item.status === 'active' && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>营业中</Text>
          </View>
        )}
      </View>

      {item.ratingAvg !== undefined && (
        <View style={styles.ratingRow} accessibilityLabel={`${item.name}评分`}>
          <Text style={styles.ratingText}>
            <Text>★ </Text>
            <Text>{item.ratingAvg}</Text>
            <Text>分</Text>
          </Text>
          <Text style={styles.ratingCount}>
            <Text>(</Text>
            <Text>{item.ratingCount || 0}</Text>
            <Text>人评价)</Text>
          </Text>
        </View>
      )}

      <Text style={styles.address}>{item.address}</Text>

      <View style={styles.priceRow}>
        <Text style={styles.price}>¥{item.pricePerHour}/小时</Text>
        <Text style={styles.courtCount}>{item.courtCount}个球场</Text>
      </View>

      {renderFacilityTags(item)}
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
          onPress={() => loadVenues(1, true)}
          accessibilityLabel="重试"
        >
          <Text style={styles.retryButtonText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (venues.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>暂无场地</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={venues}
      renderItem={renderVenueItem}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.listContainer}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={renderFooter}
      accessibilityLabel="场地列表"
    />
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
    marginBottom: 8,
  },
  venueName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ratingText: {
    fontSize: 14,
    color: '#f39c12',
    fontWeight: '600',
  },
  ratingCount: {
    fontSize: 12,
    color: '#999',
    marginLeft: 6,
  },
  address: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  price: {
    fontSize: 15,
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  courtCount: {
    fontSize: 13,
    color: '#666',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: '#e8f4fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 11,
    color: '#3498db',
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
