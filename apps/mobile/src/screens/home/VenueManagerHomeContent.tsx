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
import { venueService } from '@/api/venue.service';
import type { VenueListItem } from '@shared/venue';
import type { HomeStackNavigationProp, VenueManagerTabNavigationProp } from '@/navigation/types';
import { VENUE_STATUS_LABELS } from '@shared/venue';

export function VenueManagerHomeContent() {
  const navigation = useNavigation<HomeStackNavigationProp>();
  const tabNavigation = useNavigation<VenueManagerTabNavigationProp>();
  const user = useAppStore((state) => state.user);

  const [venues, setVenues] = useState<VenueListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const venuesRes = await venueService.getMyVenues();
      setVenues(venuesRes);
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
        <Text style={styles.subtitle}>场地方首页</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('VenueList')}
          accessibilityLabel="管理场地"
          accessibilityRole="button"
        >
          <Text style={styles.actionButtonText}>管理场地</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => tabNavigation.navigate('VenuesTab')}
          accessibilityLabel="新建场地"
          accessibilityRole="button"
        >
          <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>新建场地</Text>
        </TouchableOpacity>
      </View>

      {/* Venue Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>我的场地</Text>
        {venues.length === 0 ? (
          <Text style={styles.emptyText}>暂无场地，点击新建场地添加</Text>
        ) : (
          venues.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => navigation.navigate('VenueDetail', { venueId: item.id })}
              accessibilityLabel={`场地卡片-${item.id}`}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>{item.name}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: item.status === 'active' ? '#27ae60' : '#e74c3c' },
                  ]}
                >
                  <Text style={styles.statusText}>
                    {VENUE_STATUS_LABELS[item.status] || item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardAddress}>{item.address}</Text>
              <Text style={styles.cardInfo}>
                ¥{item.pricePerHour}/小时 | {item.courtCount}个场地
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Stats Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>场地统计</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{venues.length}</Text>
            <Text style={styles.statLabel}>总场地数</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {venues.filter((v) => v.status === 'active').length}
            </Text>
            <Text style={styles.statLabel}>营业中</Text>
          </View>
        </View>
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
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#3498db',
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
  cardName: {
    fontSize: 15,
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
  cardAddress: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  cardInfo: {
    fontSize: 13,
    color: '#999',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3498db',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});
