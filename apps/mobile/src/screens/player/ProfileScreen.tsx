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
import { playerService } from '@/api/player.service';
import { POSITION_LABELS, GENDER_LABELS } from '@shared/player';
import type { PlayerProfile } from '@shared/player';
import type { ProfileScreenNavigationProp } from '@/navigation/types';

export function ProfileScreen() {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setError(undefined);
      const data = await playerService.getProfile();
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
    playerService
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
      navigation.navigate('EditProfile', { profile });
    }
  };

  const handleViewAbility = () => {
    if (profile) {
      navigation.navigate('Ability', {
        ability: {
          baseAbilityScore: profile.baseAbilityScore,
          matchAdjustValue: profile.matchAdjustValue,
          totalAbilityScore: profile.totalAbilityScore,
        },
      });
    }
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
        <InfoRow label="性别" value={GENDER_LABELS[profile.gender]} />
        <InfoRow label="年龄" value={`${profile.age}岁`} />
        <InfoRow label="球龄" value={`${profile.basketballAge}年`} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>身体属性</Text>
        <InfoRow label="身高" value={`${profile.height}cm`} />
        {profile.weight !== undefined && <InfoRow label="体重" value={`${profile.weight}kg`} />}
        {profile.wingspan !== undefined && <InfoRow label="臂展" value={`${profile.wingspan}cm`} />}
        {profile.standingReach !== undefined && (
          <InfoRow label="站立摸高" value={`${profile.standingReach}cm`} />
        )}
        {profile.jumpingReach !== undefined && (
          <InfoRow label="起跳摸高" value={`${profile.jumpingReach}cm`} />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>位置</Text>
        <View style={styles.positionsRow} accessibilityLabel="位置">
          {profile.positions.map((pos) => (
            <View key={pos.position} style={styles.positionChip}>
              <Text style={styles.positionChipText}>{POSITION_LABELS[pos.position]}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>能力值</Text>
        <View style={styles.abilityRow}>
          <View style={styles.abilityItem}>
            <Text style={styles.abilityLabel} accessibilityLabel="基础能力值">
              基础能力值
            </Text>
            <Text style={styles.abilityValue}>{profile.baseAbilityScore}</Text>
          </View>
          <View style={styles.abilityItem}>
            <Text style={styles.abilityLabel} accessibilityLabel="综合能力值">
              综合能力值
            </Text>
            <Text style={styles.abilityValue}>{profile.totalAbilityScore}</Text>
          </View>
        </View>
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

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleViewAbility}
          accessibilityLabel="查看能力值详情"
          accessibilityRole="button"
        >
          <Text style={styles.secondaryButtonText}>查看能力值详情</Text>
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
  positionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  positionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#3498db',
  },
  positionChipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  abilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  abilityItem: {
    alignItems: 'center',
  },
  abilityLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  abilityValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3498db',
  },
  buttonSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
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
});
