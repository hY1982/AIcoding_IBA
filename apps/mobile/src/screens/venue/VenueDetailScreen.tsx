import React, { useState, useCallback, useEffect } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { venueService } from '@/api/venue.service';
import { useAppStore } from '@/stores';
import type { VenueDetail, VenueDisplaySlot } from '@shared/venue';
import { FLOOR_MATERIAL_LABELS, COURT_TYPE_LABELS, VENUE_STATUS_LABELS } from '@shared/venue';
import type {
  VenueDetailScreenNavigationProp,
  VenueDetailScreenRouteProp,
} from '@/navigation/types';

/**
 * 生成未来 N 天的日期列表
 */
function generateDateRange(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

const DATE_RANGE_DAYS = 7;

export function VenueDetailScreen() {
  const navigation = useNavigation<VenueDetailScreenNavigationProp>();
  const route = useRoute<VenueDetailScreenRouteProp>();
  const { venueId } = route.params;
  const user = useAppStore((state) => state.user);

  const [venue, setVenue] = useState<VenueDetail | null>(null);
  const [displaySlots, setDisplaySlots] = useState<Record<string, VenueDisplaySlot[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);

  const isManager = user?.userType === 'venue_manager';
  const dateRange = generateDateRange(DATE_RANGE_DAYS);

  const loadData = useCallback(async () => {
    try {
      setError(undefined);
      const venueData = await venueService.getVenueDetail(venueId);
      setVenue(venueData);

      // 并行加载未来 N 天的展示时段
      const slotsMap: Record<string, VenueDisplaySlot[]> = {};
      await Promise.all(
        dateRange.map(async (date) => {
          try {
            const slots = await venueService.getVenueDisplaySlots(venueId, date);
            slotsMap[date] = slots;
          } catch {
            slotsMap[date] = [];
          }
        }),
      );
      setDisplaySlots(slotsMap);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      setError(message);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [venueId]);

  useEffect(() => {
    setIsLoading(true);
    loadData();
  }, [venueId, loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleEdit = () => {
    if (venue) {
      navigation.navigate('EditVenue', { venue });
    }
  };

  const handleManageUnavailableSlots = () => {
    navigation.navigate('UnavailableSlots', { venueId, venueName: venue?.name || '' });
  };

  const handleDelete = () => {
    console.log('[VenueDetail] handleDelete called, venueId:', venueId, 'isManager:', isManager);
    const doDelete = async () => {
      console.log('[VenueDetail] delete confirmed');
      try {
        await venueService.deleteVenue(venueId);
        console.log('[VenueDetail] delete success');
        navigation.goBack();
      } catch (err) {
        console.error('[VenueDetail] delete error:', err);
        const message = err instanceof Error ? err.message : '删除失败';
        Alert.alert('删除失败', message);
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`确定要删除场地 "${venue?.name}" 吗？此操作不可恢复。`)) {
        doDelete();
      }
    } else {
      Alert.alert('确认删除', `确定要删除场地 "${venue?.name}" 吗？此操作不可恢复。`, [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
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

  if (!venue) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>场地不存在</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      accessibilityLabel="场地详情滚动区"
    >
      {/* 头部信息 */}
      <View style={styles.header}>
        <Text style={styles.venueName}>{venue.name}</Text>
        <View
          style={[
            styles.statusBadge,
            venue.status === 'active' ? styles.statusActive : styles.statusInactive,
          ]}
          accessibilityLabel="场地状态"
        >
          <Text style={styles.statusBadgeText}>{VENUE_STATUS_LABELS[venue.status]}</Text>
        </View>
      </View>

      {/* 评分信息 */}
      {venue.ratingAvg !== undefined && (
        <View style={styles.section} accessibilityLabel="评分信息">
          <View style={styles.ratingRow}>
            <Text style={styles.ratingStar}>
              <Text>★ </Text>
              <Text>{venue.ratingAvg}</Text>
              <Text>分</Text>
            </Text>
            <Text style={styles.ratingCount}>
              <Text>(</Text>
              <Text>{venue.ratingCount || 0}</Text>
              <Text>人评价)</Text>
            </Text>
          </View>
        </View>
      )}

      {/* 基本信息 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>基本信息</Text>
        <InfoRow label="地址" value={venue.address} />
        <InfoRow label="价格" value={`¥${venue.pricePerHour}/小时`} />
        <InfoRow label="球场数量" value={`${venue.courtCount}个`} />
        {venue.openTime && venue.closeTime && (
          <InfoRow label="营业时间" value={`${venue.openTime}-${venue.closeTime}`} />
        )}
        {venue.floorMaterial && (
          <InfoRow label="地面材质" value={FLOOR_MATERIAL_LABELS[venue.floorMaterial]} />
        )}
        {venue.courtType && <InfoRow label="场地类型" value={COURT_TYPE_LABELS[venue.courtType]} />}
        {venue.lighting && <InfoRow label="照明" value={venue.lighting} />}
        {venue.turnoverTime !== undefined && (
          <InfoRow label="翻场时间" value={`${venue.turnoverTime}分钟`} />
        )}
      </View>

      {/* 配套设施 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>配套设施</Text>
        <View style={styles.facilityGrid} accessibilityLabel="配套设施">
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

      {/* 可预订时段 - 新系统：连续时间轴展示 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>可预订时段</Text>
        <View accessibilityLabel="时段列表">
          {dateRange.map((date) => {
            const slots = displaySlots[date] || [];
            return (
              <View key={date} style={styles.dateGroup}>
                <Text style={styles.dateLabel}>{date}</Text>
                {slots.length === 0 ? (
                  <Text style={styles.emptySlotsText}>加载中...</Text>
                ) : (
                  slots.map((slot, index) => (
                    <View
                      key={`${date}-${index}`}
                      style={[
                        styles.slotRow,
                        slot.status === 'available' && styles.slotRowAvailable,
                        slot.status === 'unavailable' && styles.slotRowUnavailable,
                        slot.status === 'booked' && styles.slotRowBooked,
                      ]}
                    >
                      <Text style={styles.slotTime}>
                        {slot.startTime} - {slot.endTime}
                      </Text>
                      <View style={styles.slotStatus}>
                        {slot.status === 'available' && (
                          <Text style={styles.slotAvailable} accessibilityLabel="时段-可预订">
                            可预订
                          </Text>
                        )}
                        {slot.status === 'unavailable' && (
                          <Text style={styles.slotUnavailable} accessibilityLabel="时段-不可预订">
                            {slot.reason || '不可预订'}
                          </Text>
                        )}
                        {slot.status === 'booked' && (
                          <Text style={styles.slotBooked} accessibilityLabel="时段-已占用">
                            已占用
                          </Text>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* 操作按钮 - 根据角色显示不同内容 */}
      <View style={styles.buttonSection}>
        {isManager ? (
          <>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleEdit}
              accessibilityLabel="编辑场地"
            >
              <Text style={styles.primaryButtonText}>编辑场地</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleManageUnavailableSlots}
              accessibilityLabel="管理不可预订时段"
            >
              <Text style={styles.secondaryButtonText}>管理不可预订时段</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dangerButton}
              onPress={handleDelete}
              accessibilityLabel="删除场地"
            >
              <Text style={styles.dangerButtonText}>删除场地</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleGoBack}
            accessibilityLabel="返回列表"
          >
            <Text style={styles.secondaryButtonText}>返回列表</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} accessibilityLabel={`${label}值`}>
        {value}
      </Text>
    </View>
  );
}

function FacilityItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <View
      style={[styles.facilityItem, active ? styles.facilityActive : styles.facilityInactive]}
      accessibilityLabel={`设施-${label}-${active ? '有' : '无'}`}
    >
      <Text style={active ? styles.facilityTextActive : styles.facilityText}>{label}</Text>
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
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStar: {
    fontSize: 16,
    color: '#f39c12',
    fontWeight: 'bold',
  },
  ratingCount: {
    fontSize: 13,
    color: '#999',
    marginLeft: 8,
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
  dateGroup: {
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  slotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    marginBottom: 6,
  },
  slotRowAvailable: {
    backgroundColor: '#e8f5e9',
  },
  slotRowUnavailable: {
    backgroundColor: '#f5f5f5',
  },
  slotRowBooked: {
    backgroundColor: '#ffebee',
  },
  slotTime: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  slotStatus: {
    minWidth: 80,
    alignItems: 'flex-end',
  },
  slotAvailable: {
    fontSize: 13,
    color: '#27ae60',
    fontWeight: '600',
  },
  slotUnavailable: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  slotBooked: {
    fontSize: 13,
    color: '#e74c3c',
    fontWeight: '600',
  },
  emptySlotsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
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
  secondaryButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3498db',
  },
  secondaryButtonText: {
    color: '#3498db',
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
