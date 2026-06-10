import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { venueService } from '@/api/venue.service';
import { ValidatedTextInput } from '@/components/form/ValidatedTextInput';
import type { VenueUnavailableSlot } from '@shared/venue';
import type {
  UnavailableSlotsScreenNavigationProp,
  UnavailableSlotsScreenRouteProp,
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

/**
 * 生成 15 分钟粒度的时间选项 (00:00 - 23:45)
 */
function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hh = h.toString().padStart(2, '0');
      const mm = m.toString().padStart(2, '0');
      options.push(`${hh}:${mm}`);
    }
  }
  return options;
}

const DATE_RANGE_DAYS = 14;
const TIME_OPTIONS = generateTimeOptions();

export function UnavailableSlotsScreen() {
  const navigation = useNavigation<UnavailableSlotsScreenNavigationProp>();
  const route = useRoute<UnavailableSlotsScreenRouteProp>();
  const { venueId, venueName } = route.params;

  const dateRange = generateDateRange(DATE_RANGE_DAYS);
  const [selectedDate, setSelectedDate] = useState(dateRange[0]);
  const [unavailableSlots, setUnavailableSlots] = useState<VenueUnavailableSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // 表单状态
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | undefined>();

  const loadSlots = useCallback(async () => {
    try {
      setError(undefined);
      setIsLoading(true);
      const slots = await venueService.getUnavailableSlots(venueId, selectedDate);
      setUnavailableSlots(slots);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [venueId, selectedDate]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const validateForm = (): boolean => {
    // 校验时间格式
    if (!TIME_OPTIONS.includes(startTime)) {
      setFormError('开始时间格式不正确，必须是15分钟粒度');
      return false;
    }
    if (!TIME_OPTIONS.includes(endTime)) {
      setFormError('结束时间格式不正确，必须是15分钟粒度');
      return false;
    }

    // 校验开始时间 < 结束时间
    const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
    const endMinutes = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]);
    if (startMinutes >= endMinutes) {
      setFormError('结束时间必须晚于开始时间');
      return false;
    }

    // 校验与现有时段不重叠
    for (const slot of unavailableSlots) {
      const s1 = parseInt(slot.startTime.split(':')[0]) * 60 + parseInt(slot.startTime.split(':')[1]);
      const e1 = parseInt(slot.endTime.split(':')[0]) * 60 + parseInt(slot.endTime.split(':')[1]);
      if (startMinutes < e1 && endMinutes > s1) {
        setFormError(`与已有时段 ${slot.startTime}-${slot.endTime} 重叠`);
        return false;
      }
    }

    setFormError(undefined);
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await venueService.createUnavailableSlot(venueId, {
        slotDate: selectedDate,
        startTime,
        endTime,
        reason: reason.trim() || undefined,
      });
      // 清空表单
      setReason('');
      setFormError(undefined);
      // 刷新列表
      await loadSlots();
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建失败';
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (slot: VenueUnavailableSlot) => {
    Alert.alert('确认删除', `确定要删除 ${slot.startTime}-${slot.endTime} 的不可预订时段吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await venueService.deleteUnavailableSlot(venueId, slot.id);
            await loadSlots();
          } catch (err) {
            const message = err instanceof Error ? err.message : '删除失败';
            Alert.alert('删除失败', message);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      {/* 标题 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{venueName}</Text>
        <Text style={styles.headerSubtitle}>管理不可预订时段</Text>
      </View>

      {/* 日期选择 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>选择日期</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
          {dateRange.map((date) => (
            <TouchableOpacity
              key={date}
              style={[styles.dateChip, selectedDate === date && styles.dateChipActive]}
              onPress={() => setSelectedDate(date)}
            >
              <Text style={selectedDate === date ? styles.dateChipTextActive : styles.dateChipText}>
                {date.slice(5)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 录入表单 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>录入不可预订时段</Text>

        <Text style={styles.label}>开始时间</Text>
        <View style={styles.timePickerRow}>
          {TIME_OPTIONS.filter((_, i) => i % 4 === 0).map((time) => (
            <TouchableOpacity
              key={time}
              style={[styles.timeChip, startTime === time && styles.timeChipActive]}
              onPress={() => setStartTime(time)}
            >
              <Text style={startTime === time ? styles.timeChipTextActive : styles.timeChipText}>
                {time}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>结束时间</Text>
        <View style={styles.timePickerRow}>
          {TIME_OPTIONS.filter((_, i) => i % 4 === 0).map((time) => (
            <TouchableOpacity
              key={time}
              style={[styles.timeChip, endTime === time && styles.timeChipActive]}
              onPress={() => setEndTime(time)}
            >
              <Text style={endTime === time ? styles.timeChipTextActive : styles.timeChipText}>
                {time}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ValidatedTextInput
          label="原因（可选）"
          value={reason}
          onChangeText={setReason}
          placeholder="例如：场地维护、包场活动"
          accessibilityLabel="不可预订原因"
        />

        {formError && <Text style={styles.formError}>{formError}</Text>}

        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? '提交中...' : '添加不可预订时段'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 已录入列表 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {selectedDate} 已录入的不可预订时段
        </Text>

        {isLoading ? (
          <ActivityIndicator size="small" color="#3498db" style={styles.loader} />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadSlots}>
              <Text style={styles.retryButtonText}>重试</Text>
            </TouchableOpacity>
          </View>
        ) : unavailableSlots.length === 0 ? (
          <Text style={styles.emptyText}>该日期暂无不可预订时段</Text>
        ) : (
          unavailableSlots.map((slot) => (
            <View key={slot.id} style={styles.slotItem}>
              <View style={styles.slotInfo}>
                <Text style={styles.slotTime}>
                  {slot.startTime} - {slot.endTime}
                </Text>
                {slot.reason && <Text style={styles.slotReason}>{slot.reason}</Text>}
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(slot)}
              >
                <Text style={styles.deleteButtonText}>删除</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
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
  dateScroll: {
    flexDirection: 'row',
  },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dateChipActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  dateChipText: {
    fontSize: 14,
    color: '#333',
  },
  dateChipTextActive: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginTop: 8,
    marginBottom: 8,
  },
  timePickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  timeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
    minWidth: 50,
    alignItems: 'center',
  },
  timeChipActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  timeChipText: {
    fontSize: 12,
    color: '#333',
  },
  timeChipTextActive: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  formError: {
    fontSize: 13,
    color: '#e74c3c',
    marginTop: 8,
    marginBottom: 8,
  },
  submitButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loader: {
    marginVertical: 20,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  slotItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  slotInfo: {
    flex: 1,
  },
  slotTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  slotReason: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  deleteButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e74c3c',
  },
  deleteButtonText: {
    color: '#e74c3c',
    fontSize: 13,
    fontWeight: '600',
  },
});
