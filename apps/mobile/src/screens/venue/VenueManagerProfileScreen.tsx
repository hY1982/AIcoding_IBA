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
import { venueManagerService } from '@/api/venue-manager.service';
import type { VenueManagerProfile } from '@shared/venue-manager';
import type { VenueListItem } from '@shared/venue';
import { FLOOR_MATERIAL_LABELS, COURT_TYPE_LABELS, VENUE_STATUS_LABELS } from '@shared/venue';
import type { VenueManagerProfileScreenNavigationProp } from '@/navigation/types';

export function VenueManagerProfileScreen() {
  const navigation = useNavigation<VenueManagerProfileScreenNavigationProp>();
  const [profile, setProfile] = useState<VenueManagerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setError(undefined);
      const data = await venueManagerService.getProfile();
      setProfile(data);
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
      loadProfile();
    }, [loadProfile]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    setIsLoading(true);
    setError(undefined);
    venueManagerService
      .getProfile()
      .then((data) => {
        setProfile(data);
        setIsLoading(false);
        setRefreshing(false);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : '加载失败';
        setError(message);
        setIsLoading(false);
        setRefreshing(false);
      });
  };

  const handleEdit = () => {
    if (profile) {
      navigation.navigate('EditVenueManagerProfile', { profile });
    }
  };

  const handleCreateVenue = () => {
    navigation.navigate('CreateVenue');
  };

  const handleVenuePress = (venue: VenueListItem) => {
    navigation.navigate('VenueDetail', { venueId: venue.id });
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

  if (!profile) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>暂无资料</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View style={styles.avatar} accessibilityLabel={profile.avatarUrl ? '头像' : '默认头像'}>
          <Text style={styles.avatarText}>{profile.nickname.charAt(0)}</Text>
        </View>
        <Text style={styles.nickname} accessibilityLabel="昵称">
          {profile.nickname}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>基本信息</Text>
        <InfoRow label="手机号" value={profile.phone} />
        <InfoRow label="真实姓名" value={profile.realName} />
        {profile.companyName && <InfoRow label="公司名称" value={profile.companyName} />}
        {profile.contactName && <InfoRow label="联系人" value={profile.contactName} />}
        {profile.contactPhone && <InfoRow label="联系电话" value={profile.contactPhone} />}
      </View>

      <View style={styles.section}>
        <View style={styles.venueSectionHeader}>
          <Text style={styles.sectionTitle}>我的场地</Text>
          <TouchableOpacity
            style={styles.addVenueButton}
            onPress={handleCreateVenue}
            accessibilityLabel="新建场地"
            accessibilityRole="button"
          >
            <Text style={styles.addVenueButtonText}>+ 新建场地</Text>
          </TouchableOpacity>
        </View>
        {profile.venues.length === 0 ? (
          <Text style={styles.emptyVenueText}>暂无场地</Text>
        ) : (
          profile.venues.map((venue) => (
            <TouchableOpacity
              key={venue.id}
              style={styles.venueCard}
              onPress={() => handleVenuePress(venue)}
              accessibilityLabel={`场地: ${venue.name}`}
              accessibilityRole="button"
            >
              <View style={styles.venueCardHeader}>
                <Text style={styles.venueName}>{venue.name}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    venue.status === 'active' ? styles.statusActive : styles.statusInactive,
                  ]}
                >
                  <Text style={styles.statusBadgeText}>{VENUE_STATUS_LABELS[venue.status]}</Text>
                </View>
              </View>
              <Text style={styles.venueAddress}>{venue.address}</Text>
              <View style={styles.venueInfoRow}>
                <Text style={styles.venueInfo}>¥{venue.pricePerHour}/小时</Text>
                <Text style={styles.venueInfo}>{venue.courtCount}个球场</Text>
                {venue.courtType && (
                  <Text style={styles.venueInfo}>{COURT_TYPE_LABELS[venue.courtType]}</Text>
                )}
                {venue.floorMaterial && (
                  <Text style={styles.venueInfo}>{FLOOR_MATERIAL_LABELS[venue.floorMaterial]}</Text>
                )}
              </View>
              <View style={styles.facilityRow}>
                {venue.ventilation && <Text style={styles.facilityTag}>通风</Text>}
                {venue.bigFan && <Text style={styles.facilityTag}>大风扇</Text>}
                {venue.airCondition && <Text style={styles.facilityTag}>空调</Text>}
                {venue.parking && <Text style={styles.facilityTag}>停车场</Text>}
                {venue.restroom && <Text style={styles.facilityTag}>洗手间</Text>}
                {venue.shower && <Text style={styles.facilityTag}>淋浴</Text>}
                {venue.lockerRoom && <Text style={styles.facilityTag}>更衣室</Text>}
                {venue.videoRecord && <Text style={styles.facilityTag}>录像</Text>}
              </View>
              <Text style={styles.tapHint}>点击查看详情/编辑</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.buttonSection}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleEdit}
          accessibilityLabel="编辑资料"
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>编辑资料</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel} accessibilityLabel={label}>
        {label}
      </Text>
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
  emptyText: {
    fontSize: 16,
    color: '#999',
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
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  nickname: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    includeFontPadding: false,
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
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
    includeFontPadding: false,
  },
  venueSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addVenueButton: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addVenueButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyVenueText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 16,
  },
  venueCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  venueName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  venueAddress: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  venueInfoRow: {
    flexDirection: 'row',
    gap: 16,
  },
  venueInfo: {
    fontSize: 13,
    color: '#3498db',
    fontWeight: '500',
  },
  venueCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusActive: {
    backgroundColor: '#27ae60',
  },
  statusInactive: {
    backgroundColor: '#e74c3c',
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  facilityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  facilityTag: {
    fontSize: 11,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tapHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    textAlign: 'right',
  },
  buttonSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
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
});
