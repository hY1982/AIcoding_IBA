import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { intentionService } from '@/api/intention.service';
import { venueService } from '@/api/venue.service';
import { formatService } from '@/api/format.service';
import { ChipMultiSelect } from '@/components/ChipMultiSelect';
import type { VenueListItem } from '@shared/venue';
import type { Format } from '@shared/format';
import type { CreateIntentionScreenNavigationProp } from '@/navigation/types';

// Duration options in minutes
const DURATION_OPTIONS = [
  { label: '2h', value: 120 },
  { label: '2.5h', value: 150 },
  { label: '3h', value: 180 },
  { label: '4h', value: 240 },
  { label: '5h', value: 300 },
  { label: '6h', value: 360 },
];

// Generate time slots: 8:00 to 22:00 every 30 min
function generateAllTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 8; h <= 22; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
    if (h < 22) {
      slots.push(`${h.toString().padStart(2, '0')}:30`);
    }
  }
  return slots;
}

const ALL_TIME_SLOTS = generateAllTimeSlots();

// Generate next 7 days
function generateDateOptions(): { label: string; date: Date }[] {
  const now = new Date(Date.now());
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const options: { label: string; date: Date }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    let label: string;
    if (i === 0) label = '今天';
    else if (i === 1) label = '明天';
    else label = `${d.getMonth() + 1}/${d.getDate()}`;
    options.push({ label, date: d });
  }
  return options;
}

export function CreateIntentionScreen() {
  const navigation = useNavigation<CreateIntentionScreenNavigationProp>();

  // Data loading states
  const [venues, setVenues] = useState<VenueListItem[]>([]);
  const [formats, setFormats] = useState<Format[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Form states
  const [selectedDateIndex, setSelectedDateIndex] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [selectedVenues, setSelectedVenues] = useState<VenueListItem[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<Format[]>([]);
  const [acceptableWait, setAcceptableWait] = useState(30);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Submission states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const dateOptions = generateDateOptions();

  // Load venues and formats
  useEffect(() => {
    const loadData = async () => {
      try {
        const [venueRes, formatRes] = await Promise.all([
          venueService.getVenues({ page: 1, pageSize: 100 }),
          formatService.getFormats(),
        ]);
        setVenues(venueRes.list);
        setFormats(formatRes);
      } catch (err) {
        const message = err instanceof Error ? err.message : '加载失败';
        setDataError(message);
      } finally {
        setIsDataLoading(false);
      }
    };
    loadData();
  }, []);

  // Filter time slots for today (>= now + 1h)
  const getAvailableTimeSlots = useCallback((): string[] => {
    if (selectedDateIndex === null) return ALL_TIME_SLOTS;

    const selectedDate = dateOptions[selectedDateIndex].date;
    const now = new Date(Date.now());
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Check if selected date is today
    if (selectedDate.getTime() === today.getTime()) {
      const minTime = new Date(now.getTime() + 60 * 60 * 1000); // now + 1h
      const minHour = minTime.getHours();
      const minMinute = minTime.getMinutes();

      return ALL_TIME_SLOTS.filter((slot) => {
        const [h, m] = slot.split(':').map(Number);
        return h > minHour || (h === minHour && m >= minMinute);
      });
    }

    return ALL_TIME_SLOTS;
  }, [selectedDateIndex, dateOptions]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (selectedDateIndex === null) {
      newErrors.date = '请选择日期';
    }
    if (selectedTime === null) {
      newErrors.time = '请选择时间';
    }
    if (selectedDuration === null) {
      newErrors.duration = '请选择持续时长';
    }
    if (selectedVenues.length === 0) {
      newErrors.venues = '请至少选择一个场地';
    }
    if (selectedFormats.length === 0) {
      newErrors.formats = '请至少选择一个赛制';
    }

    // Validate startTime >= now + 1h
    if (selectedDateIndex !== null && selectedTime !== null) {
      const selectedDate = dateOptions[selectedDateIndex].date;
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const startTime = new Date(selectedDate);
      startTime.setHours(hours, minutes, 0, 0);
      const minStartTime = new Date(Date.now() + 60 * 60 * 1000);
      if (startTime < minStartTime) {
        newErrors.time = '开始时间需至少提前1小时';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const selectedDate = dateOptions[selectedDateIndex!].date;
      const [hours, minutes] = selectedTime!.split(':').map(Number);
      const startTime = new Date(selectedDate);
      startTime.setHours(hours, minutes, 0, 0);

      await intentionService.createIntention({
        startTime: startTime.toISOString(),
        durationMinutes: selectedDuration!,
        acceptableWaitMinutes: acceptableWait,
        venueIds: selectedVenues.map((v, i) => ({ venueId: v.id, priority: i + 1 })),
        formatIds: selectedFormats.map((f, i) => ({ formatId: f.id, priority: i + 1 })),
      });

      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : '提交失败';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isDataLoading) {
    return (
      <View style={styles.centerContainer} accessibilityLabel="加载中">
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  if (dataError) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{dataError}</Text>
      </View>
    );
  }

  const availableTimeSlots = getAvailableTimeSlots();

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
      {/* Date Selection */}
      <Text style={styles.sectionLabel}>选择日期</Text>
      <View style={styles.chipRow}>
        {dateOptions.map((opt, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.chip, selectedDateIndex === index && styles.chipSelected]}
            onPress={() => {
              setSelectedDateIndex(index);
              setSelectedTime(null); // Reset time when date changes
              setErrors((prev) => ({ ...prev, date: '' }));
            }}
            accessibilityLabel={opt.label}
          >
            <Text style={[styles.chipText, selectedDateIndex === index && styles.chipTextSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {errors.date ? <Text style={styles.fieldError}>{errors.date}</Text> : null}

      {/* Time Selection */}
      <Text style={styles.sectionLabel}>选择时间</Text>
      {selectedDateIndex !== null ? (
        availableTimeSlots.length > 0 ? (
          <View style={styles.chipRow}>
            {availableTimeSlots.map((time) => (
              <TouchableOpacity
                key={time}
                style={[styles.chip, selectedTime === time && styles.chipSelected]}
                onPress={() => {
                  setSelectedTime(time);
                  setErrors((prev) => ({ ...prev, time: '' }));
                }}
                accessibilityLabel={time}
              >
                <Text style={[styles.chipText, selectedTime === time && styles.chipTextSelected]}>
                  {time}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.hintText}>今天已无可用时段，请选择其他日期</Text>
        )
      ) : (
        <Text style={styles.hintText}>请先选择日期</Text>
      )}
      {errors.time ? <Text style={styles.fieldError}>{errors.time}</Text> : null}

      {/* Duration Selection */}
      <Text style={styles.sectionLabel}>持续时长</Text>
      <View style={styles.chipRow}>
        {DURATION_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, selectedDuration === opt.value && styles.chipSelected]}
            onPress={() => {
              setSelectedDuration(opt.value);
              setErrors((prev) => ({ ...prev, duration: '' }));
            }}
            accessibilityLabel={opt.label}
          >
            <Text
              style={[styles.chipText, selectedDuration === opt.value && styles.chipTextSelected]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {errors.duration ? <Text style={styles.fieldError}>{errors.duration}</Text> : null}

      {/* Venue Selection */}
      <ChipMultiSelect
        items={venues}
        selectedItems={selectedVenues}
        keyExtractor={(v) => v.id}
        labelExtractor={(v) => v.name}
        onSelectionChange={(items) => {
          setSelectedVenues(items);
          if (items.length > 0) setErrors((prev) => ({ ...prev, venues: '' }));
        }}
        maxSelection={3}
        label="选择场地"
        error={errors.venues}
        emptyText="暂无可用场地"
      />

      {/* Format Selection */}
      <ChipMultiSelect
        items={formats}
        selectedItems={selectedFormats}
        keyExtractor={(f) => f.id}
        labelExtractor={(f) => f.name}
        onSelectionChange={(items) => {
          setSelectedFormats(items);
          if (items.length > 0) setErrors((prev) => ({ ...prev, formats: '' }));
        }}
        maxSelection={3}
        label="选择赛制"
        error={errors.formats}
        emptyText="暂无可用赛制，请联系管理员"
      />

      {/* Submit Error */}
      {submitError ? <Text style={styles.submitErrorText}>{submitError}</Text> : null}

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        accessibilityLabel="提交意向"
        accessibilityRole="button"
        accessibilityState={{ disabled: isSubmitting }}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>提交意向</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    padding: 20,
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
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
    color: '#333',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f5f5f5',
  },
  chipSelected: {
    backgroundColor: '#1a73e8',
    borderColor: '#1a73e8',
  },
  chipText: {
    fontSize: 14,
    color: '#333',
  },
  chipTextSelected: {
    color: '#fff',
  },
  fieldError: {
    marginTop: 4,
    fontSize: 12,
    color: '#e74c3c',
  },
  hintText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  submitErrorText: {
    fontSize: 14,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    backgroundColor: '#a0c4e8',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
