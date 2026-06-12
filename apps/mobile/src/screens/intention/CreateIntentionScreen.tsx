import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { intentionService } from '@/api/intention.service';
import { venueService } from '@/api/venue.service';
import { formatService } from '@/api/format.service';
import { ChipMultiSelect } from '@/components/ChipMultiSelect';
import { DropdownSelect } from '@/components/DropdownSelect';
import type { VenueListItem } from '@shared/venue';
import type { Format } from '@shared/format';
import type {
  CreateIntentionScreenNavigationProp,
  CreateIntentionScreenRouteProp,
} from '@/navigation/types';

// Duration options in minutes, every 30 min from 0.5h to 6h
const DURATION_OPTIONS: { label: string; value: number }[] = [];
for (let m = 30; m <= 360; m += 30) {
  const h = Math.floor(m / 60);
  const rem = m % 60;
  let label: string;
  if (h === 0) label = `${rem}分钟`;
  else if (rem === 0) label = `${h}小时`;
  else label = `${h}小时${rem}分钟`;
  DURATION_OPTIONS.push({ label, value: m });
}

// Acceptable wait time options
const ACCEPTABLE_WAIT_OPTIONS: { label: string; value: number }[] = [
  { label: '15分钟', value: 15 },
  { label: '30分钟', value: 30 },
  { label: '45分钟', value: 45 },
  { label: '1小时', value: 60 },
  { label: '1小时30分钟', value: 90 },
  { label: '2小时', value: 120 },
];

// Generate time slots: 6:00 to 22:00 every 30 min
function generateAllTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 6; h <= 22; h++) {
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
  const route = useRoute<CreateIntentionScreenRouteProp>();
  const editIntentionId = route.params?.intentionId;
  const isEditMode = editIntentionId !== undefined;

  // Set title based on edit mode
  React.useEffect(() => {
    navigation.setOptions({
      title: isEditMode ? '编辑意向' : '创建意向',
    });
  }, [navigation, isEditMode]);

  // Data loading states
  const [venues, setVenues] = useState<VenueListItem[]>([]);
  const [formats, setFormats] = useState<Format[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Form states (string values for dropdown)
  const [selectedDateValue, setSelectedDateValue] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedDurationValue, setSelectedDurationValue] = useState<string | null>(null);
  const [selectedVenues, setSelectedVenues] = useState<VenueListItem[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<Format[]>([]);
  const [selectedAcceptableWait, setSelectedAcceptableWait] = useState<string | null>(null);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Submission states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const dateOptions = generateDateOptions();

  // Build dropdown option arrays
  const dateDropdownOptions = dateOptions.map((opt, i) => ({
    label: opt.label,
    value: String(i),
  }));

  const durationDropdownOptions = DURATION_OPTIONS.map((opt) => ({
    label: opt.label,
    value: String(opt.value),
  }));

  const acceptableWaitDropdownOptions = ACCEPTABLE_WAIT_OPTIONS.map((opt) => ({
    label: opt.label,
    value: String(opt.value),
  }));

  // Selected date index (from string state)
  const selectedDateIndex = selectedDateValue !== null ? Number(selectedDateValue) : null;

  // Load venues and formats, then pre-fill if editing
  useEffect(() => {
    const loadData = async () => {
      try {
        const [venueRes, formatRes] = await Promise.all([
          venueService.getVenues({ page: 1, pageSize: 100 }),
          formatService.getFormats(),
        ]);
        setVenues(venueRes.list);
        setFormats(formatRes);

        // If editing, load existing intention data
        if (editIntentionId) {
          try {
            const intention = await intentionService.getMyIntentionById(editIntentionId);

            // Pre-fill duration
            setSelectedDurationValue(String(intention.durationMinutes));

            // Pre-fill acceptable wait
            setSelectedAcceptableWait(String(intention.acceptableWaitMinutes));

            // Pre-fill venues
            const prefillVenues = intention.venues
              .map((v) => venueRes.list.find((vl) => vl.id === v.venueId))
              .filter((v): v is VenueListItem => v !== undefined);
            setSelectedVenues(prefillVenues);

            // Pre-fill formats
            const prefillFormats = intention.formats
              .map((f) => formatRes.find((fl) => fl.id === f.formatId))
              .filter((f): f is Format => f !== undefined);
            setSelectedFormats(prefillFormats);

            // Pre-fill date and time from startTime
            const startDate = new Date(intention.startTime);
            const pad = (n: number) => String(n).padStart(2, '0');
            const intentionTime = `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`;

            // Find matching date in the date options
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const intentionDay = new Date(startDate);
            intentionDay.setHours(0, 0, 0, 0);

            let matchedDateIndex = -1;
            for (let i = 0; i < 7; i++) {
              const d = new Date(today);
              d.setDate(today.getDate() + i);
              if (d.getTime() === intentionDay.getTime()) {
                matchedDateIndex = i;
                break;
              }
            }

            if (matchedDateIndex >= 0) {
              setSelectedDateValue(String(matchedDateIndex));
              setSelectedTime(intentionTime);
            }
          } catch {
            // If loading existing intention fails, just show empty form
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '加载失败';
        setDataError(message);
      } finally {
        setIsDataLoading(false);
      }
    };
    loadData();
  }, [editIntentionId]);

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

  const timeDropdownOptions = getAvailableTimeSlots().map((t) => ({ label: t, value: t }));

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (selectedDateIndex === null) {
      newErrors.date = '请选择日期';
    }
    if (selectedTime === null) {
      newErrors.time = '请选择时间';
    }
    if (selectedDurationValue === null) {
      newErrors.duration = '请选择持续时长';
    }
    if (selectedVenues.length === 0) {
      newErrors.venues = '请至少选择一个场地';
    }
    if (selectedFormats.length === 0) {
      newErrors.formats = '请至少选择一个赛制';
    }
    if (selectedAcceptableWait === null) {
      newErrors.acceptableWait = '请选择可接受等待时长';
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

      // 本地日期字符串（避免时区转换）
      const pad = (n: number) => String(n).padStart(2, '0');
      const localDate = `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}`;

      const dto = {
        startTime: startTime.toISOString(),
        durationMinutes: Number(selectedDurationValue!),
        acceptableWaitMinutes: Number(selectedAcceptableWait!),
        localDate,
        localTime: selectedTime!,
        venueIds: selectedVenues.map((v, i) => ({ venueId: v.id, priority: i + 1 })),
        formatIds: selectedFormats.map((f, i) => ({ formatId: f.id, priority: i + 1 })),
      };

      if (isEditMode) {
        await intentionService.updateIntention(editIntentionId, dto);
      } else {
        await intentionService.createIntention(dto);
      }

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

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
      {/* Date Dropdown */}
      <DropdownSelect
        label="选择日期"
        options={dateDropdownOptions}
        selectedValue={selectedDateValue}
        placeholder="请选择日期"
        onSelect={(val) => {
          setSelectedDateValue(val);
          setSelectedTime(null); // Reset time when date changes
          setErrors((prev) => ({ ...prev, date: '' }));
        }}
        error={errors.date}
      />

      {/* Time Dropdown */}
      <DropdownSelect
        label="选择时间"
        options={timeDropdownOptions}
        selectedValue={selectedTime}
        placeholder={selectedDateIndex !== null ? '请选择时间' : '请先选择日期'}
        onSelect={(val) => {
          setSelectedTime(val);
          setErrors((prev) => ({ ...prev, time: '' }));
        }}
        error={errors.time}
        disabled={selectedDateIndex === null}
        emptyMessage={selectedDateIndex !== null ? '今天已无可用时段，请选择其他日期' : undefined}
      />

      {/* Duration Dropdown */}
      <DropdownSelect
        label="持续时长"
        options={durationDropdownOptions}
        selectedValue={selectedDurationValue}
        placeholder="请选择持续时长"
        onSelect={(val) => {
          setSelectedDurationValue(val);
          setErrors((prev) => ({ ...prev, duration: '' }));
        }}
        error={errors.duration}
      />

      {/* Acceptable Wait Dropdown */}
      <DropdownSelect
        label="可接受等待时长"
        options={acceptableWaitDropdownOptions}
        selectedValue={selectedAcceptableWait}
        placeholder="请选择可接受等待时长"
        onSelect={(val) => {
          setSelectedAcceptableWait(val);
          setErrors((prev) => ({ ...prev, acceptableWait: '' }));
        }}
        error={errors.acceptableWait}
      />

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
        accessibilityLabel={isEditMode ? '提交修改' : '提交意向'}
        accessibilityRole="button"
        accessibilityState={{ disabled: isSubmitting }}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>
            {isEditMode ? '提交修改' : '提交意向'}
          </Text>
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
