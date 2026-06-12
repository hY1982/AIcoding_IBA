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
  Platform,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { intentionService } from '@/api/intention.service';
import type { IntentionResponse } from '@/api/intention.service';
import type { IntentionDetailScreenRouteProp } from '@/navigation/types';
import { INTENTION_STATUS_LABELS, IntentionStatus } from '@shared/intention';
import { INTENTION_STATUS_COLORS } from '@/constants/intentionStatus';

export function IntentionDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<IntentionDetailScreenRouteProp>();
  const { intentionId } = route.params;

  const [intention, setIntention] = useState<IntentionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const loadIntention = useCallback(async () => {
    try {
      setError(null);
      const result = await intentionService.getMyIntentionById(intentionId);
      setIntention(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [intentionId]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadIntention();
    }, [loadIntention]),
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadIntention();
  }, [loadIntention]);

  const handleCancel = () => {
    const doCancel = async () => {
      try {
        setCancelError(null);
        const result = await intentionService.cancelIntention(intentionId);
        setIntention(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : '取消失败';
        setCancelError(message);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('确定要取消这个意向吗？')) {
        doCancel();
      }
    } else {
      Alert.alert('确认取消', '确定要取消这个意向吗？', [
        { text: '返回', style: 'cancel' },
        { text: '确定', style: 'destructive', onPress: doCancel },
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
            loadIntention();
          }}
          accessibilityLabel="重试"
        >
          <Text style={styles.retryButtonText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!intention) return null;

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      {/* Status Badge */}
      <View style={styles.statusSection}>
        <View style={[styles.statusBadge, { backgroundColor: INTENTION_STATUS_COLORS[intention.status] }]}>
          <Text style={styles.statusText}>{INTENTION_STATUS_LABELS[intention.status]}</Text>
        </View>
      </View>

      {/* Match Info */}
      {intention.matchId && (
        <View style={styles.card}>
          <Text style={styles.matchInfo}>关联比赛 #{intention.matchId}</Text>
        </View>
      )}

      {/* Time Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>时间信息</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>开始时间</Text>
          <Text style={styles.infoValue}>{formatDateTime(intention.startTime)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>结束时间</Text>
          <Text style={styles.infoValue}>{formatDateTime(intention.endTime)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>持续时长</Text>
          <Text style={styles.infoValue}>{intention.durationMinutes}分钟</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>可接受等待</Text>
          <Text style={styles.infoValue}>{intention.acceptableWaitMinutes}分钟</Text>
        </View>
      </View>

      {/* Venues */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>场地偏好</Text>
        {intention.venues.map((v) => (
          <Text key={v.venueId} style={styles.priorityItem}>
            {v.priority}. {v.venueName || `场地${v.venueId}`}
          </Text>
        ))}
      </View>

      {/* Formats */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>赛制偏好</Text>
        {intention.formats.map((f) => (
          <Text key={f.formatId} style={styles.priorityItem}>
            {f.priority}. {f.formatName || `赛制${f.formatId}`}
          </Text>
        ))}
      </View>

      {/* Meta Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>其他信息</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>提交时间</Text>
          <Text style={styles.infoValue}>{formatDateTime(intention.submittedAt)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>更新时间</Text>
          <Text style={styles.infoValue}>{formatDateTime(intention.updatedAt)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>过期时间</Text>
          <Text style={styles.infoValue}>{formatDateTime(intention.expiresAt)}</Text>
        </View>
      </View>

      {/* Cancel Error */}
      {cancelError && <Text style={styles.cancelErrorText}>{cancelError}</Text>}

      {/* Cancel Button (only for pending) */}
      {intention.status === 'pending' && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          accessibilityLabel="取消意向"
          accessibilityRole="button"
        >
          <Text style={styles.cancelButtonText}>取消意向</Text>
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
  matchInfo: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3498db',
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
  priorityItem: {
    fontSize: 14,
    color: '#333',
    paddingVertical: 4,
  },
  cancelErrorText: {
    fontSize: 14,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 12,
  },
  cancelButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
