import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { matchService } from '@/api/match.service';
import type { ConfirmParticipationResult } from '@/api/match.service';
import type {
  ConfirmMatchScreenNavigationProp,
  ConfirmMatchScreenRouteProp,
} from '@/navigation/types';
import { MATCH_STATUS_LABELS, MATCH_PLAYER_STATUS_LABELS } from '@shared/match';

export function ConfirmMatchScreen() {
  const navigation = useNavigation<ConfirmMatchScreenNavigationProp>();
  const route = useRoute<ConfirmMatchScreenRouteProp>();
  const { matchId, depositAmount } = route.params;

  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmResult, setConfirmResult] = useState<ConfirmParticipationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    try {
      setIsConfirming(true);
      setError(null);
      const result = await matchService.confirmParticipation(matchId);
      setConfirmResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : '确认失败';
      setError(message);
    } finally {
      setIsConfirming(false);
    }
  };

  // Processing state
  if (isConfirming) {
    return (
      <View style={styles.centerContainer} accessibilityLabel="处理中">
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.processingText}>正在确认参赛并处理支付...</Text>
      </View>
    );
  }

  // Success state (handles both normal success and alreadyConfirmed idempotent response)
  if (confirmResult) {
    const isIdempotent = confirmResult.alreadyConfirmed === true;
    return (
      <View style={styles.container}>
        <View style={styles.successSection}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successTitle}>确认成功</Text>
        </View>

        <View style={styles.resultCard}>
          {confirmResult.orderNo && (
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>订单号</Text>
              <Text style={styles.resultValue}>{confirmResult.orderNo}</Text>
            </View>
          )}
          {confirmResult.status && (
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>参赛状态</Text>
              <Text style={styles.resultValue}>
                {MATCH_PLAYER_STATUS_LABELS[confirmResult.status]}
              </Text>
            </View>
          )}
          {confirmResult.matchStatus && (
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>比赛状态</Text>
              <Text style={styles.resultValue}>
                {MATCH_STATUS_LABELS[confirmResult.matchStatus]}
              </Text>
            </View>
          )}
          <Text style={styles.resultMessage}>{confirmResult.message}</Text>
          {isIdempotent && (
            <Text style={styles.idempotentNote}>（您已确认参赛，无需重复操作）</Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="查看比赛详情"
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>查看比赛详情</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Initial confirm state
  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <Text style={styles.headerTitle}>确认参赛</Text>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>比赛编号</Text>
          <Text style={styles.infoValue}>#{matchId}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>保证金</Text>
          <Text style={styles.depositAmount}>¥{depositAmount}</Text>
        </View>
      </View>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>模拟支付说明</Text>
        <Text style={styles.noticeText}>
          点击确认后，系统将模拟保证金支付流程。实际接入支付通道后，此处将跳转至第三方支付页面。
        </Text>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={styles.confirmButton}
        onPress={handleConfirm}
        accessibilityLabel="确认并支付"
        accessibilityRole="button"
      >
        <Text style={styles.confirmButtonText}>确认并支付</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.returnButton}
        onPress={() => navigation.goBack()}
        accessibilityLabel="返回"
        accessibilityRole="button"
      >
        <Text style={styles.returnButtonText}>返回</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  processingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#666',
  },
  headerSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.05)',
    elevation: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
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
  depositAmount: {
    fontSize: 18,
    color: '#e74c3c',
    fontWeight: '700',
  },
  noticeCard: {
    backgroundColor: '#fff8e1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ffe082',
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f57f17',
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 16,
  },
  confirmButton: {
    backgroundColor: '#27ae60',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  returnButton: {
    backgroundColor: '#95a5a6',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  returnButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  successSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  successIcon: {
    fontSize: 48,
    color: '#27ae60',
    fontWeight: '700',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#27ae60',
    marginTop: 8,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.05)',
    elevation: 1,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultLabel: {
    fontSize: 14,
    color: '#999',
  },
  resultValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  resultMessage: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  idempotentNote: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  backButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
