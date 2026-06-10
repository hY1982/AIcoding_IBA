import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { venueService } from '@/api/venue.service';
import type { VenueDetail } from '@shared/venue';
import {
  FLOOR_MATERIAL_LABELS,
  COURT_TYPE_LABELS,
  VENUE_STATUS_LABELS,
} from '@shared/venue';
import type { VenueDetailScreenNavigationProp, VenueDetailScreenRouteProp } from '@/navigation/types';

export function VenueDetailScreen() {
  const navigation = useNavigation<VenueDetailScreenNavigationProp>();
  const route = useRoute<VenueDetailScreenRouteProp>();
  const { venueId } = route.params;

  const [venue, setVenue] = useState<VenueDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);

  const loadVenue = useCallback(async () => {
    try {
      setError(undefined);
      const data = await venueService.getVenueDetail(venueId);
      setVenue(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      setError(message);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [venueId]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadVenue();
    }, [loadVenue])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadVenue();
  };

  const handleEdit = () => {
    if (venue) {
      navigation.navigate('EditVenue', { venue });
    }
  };

  const handleDelete = () => {
    Alert.alert(
      '确认删除',
      `确定要删除场地 "${venue?.name}" 吗？此操作不可恢复。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await venueService.deleteVenue(venueId);
              navigation.goBack();
            } catch (err) {
              const message = err instanceof Error ? err.message : '删除失败';
              Alert.alert('删除失败', message);
            }
          },
        },
      ]
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
        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
          <Text style={styles.retryButtonText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!venue) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>场地不存在</Text>
      </View>
    );
  }

  const FacilityItem = ({ label, active }: { label: string; active?: boolean }) => (
    <View style={[styles.facilityItem, active ? styles.facilityActive : styles.facilityInactive]}>
      <Text style={active ? styles.facilityTextActive : styles.facilityText}>{label}</Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* 头部信息 */}
      <View style={styles.header}>
        <Text style={styles.venueName}>{venue.name}</Text>
        <View style={[styles.statusBadge, venue.status === 'active' ? styles.statusActive : styles.statusInactive]}>
          <Text style={styles.statusBadgeText}>{VENUE_STATUS_LABELS[venue.status]}</Text>
        </View>
      </View>

      {/* 基本信息 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>基本信息</Text>
        <InfoRow label="地址" value={venue.address} />
        <InfoRow label="价格" value={`¥${venue.pricePerHour}/小时`} />
        <InfoRow label="球场数量" value={`${venue.courtCount}个`} />
        {venue.floorMaterial && (
          <InfoRow label="地面材质" value={FLOOR_MATERIAL_LABELS[venue.floorMaterial]} />
        )}
        {venue.courtType && (
          <InfoRow label="场地类型" value={COURT_TYPE_LABELS[venue.courtType]} />
        )}
        {venue.lighting && <InfoRow label="照明" value={venue.lighting} />}
        {venue.turnoverTime !== undefined && (
          <InfoRow label="翻场时间" value={`${venue.turnoverTime}分钟`} />
        )}
      </View>

      {/* 配套设施 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>配套设施</Text>
        <View style={styles.facilityGrid}>
          <FacilityItem label="通风" active={venue.ventilation} />
          <FacilityItem label="大风扇" active={venue.bigFan} />
          <FacilityItem label="空调" active={venue.airCondition} />
          <FacilityItem label="停车场" active={venue.parking} />
          <FacilityItem label="洗手间" active={venue.restroom} />
          <FacilityItem label="淋浴" active={venue.shower} />
          <FacilityItem label="更衣室" active={venue.lockerRoom} />
          <FacilityItem label="录像" active={venue.videoRecord} />
        </View>
      </View>

      {/* 评分信息 */}
      {venue.ratingAvg !== undefined && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>评分</Text>
          <InfoRow label="平均评分" value={`${venue.ratingAvg}分`} />
          <InfoRow label="评分人数" value={`${venue.ratingCount || 0}人`} />
        </View>
      )}

      {/* 操作按钮 */}
      <View style={styles.buttonSection}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleEdit}>
          <Text style={styles.primaryButtonText}>编辑场地</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dangerButton} onPress={handleDelete}>
          <Text style={styles.dangerButtonText}>删除场地</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
  header: {
    backgroundColor: '#fff',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  venueName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#27ae60',
  },
  statusInactive: {
    backgroundColor: '#e74c3c',
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  facilityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  facilityItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  facilityActive: {
    backgroundColor: '#27ae60',
    borderColor: '#27ae60',
  },
  facilityInactive: {
    backgroundColor: '#f0f0f0',
    borderColor: '#ddd',
  },
  facilityText: {
    fontSize: 13,
    color: '#999',
  },
  facilityTextActive: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  buttonSection: {
    padding: 16,
    gap: 12,
    marginTop: 12,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#3498db',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e74c3c',
  },
  dangerButtonText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: '600',
  },
});
