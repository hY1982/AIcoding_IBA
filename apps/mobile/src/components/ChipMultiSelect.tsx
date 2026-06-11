import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ChipMultiSelectProps<T> {
  items: T[];
  selectedItems: T[];
  keyExtractor: (item: T) => string | number;
  labelExtractor: (item: T) => string;
  onSelectionChange: (selected: T[]) => void;
  maxSelection?: number;
  label: string;
  error?: string;
  emptyText?: string;
}

export function ChipMultiSelect<T>({
  items,
  selectedItems,
  keyExtractor,
  labelExtractor,
  onSelectionChange,
  maxSelection = 3,
  label,
  error,
  emptyText,
}: ChipMultiSelectProps<T>) {
  const isSelected = (item: T) =>
    selectedItems.some((s) => keyExtractor(s) === keyExtractor(item));

  const isMaxReached = selectedItems.length >= maxSelection;

  const handlePress = (item: T) => {
    if (isSelected(item)) {
      onSelectionChange(selectedItems.filter((s) => keyExtractor(s) !== keyExtractor(item)));
    } else if (!isMaxReached) {
      onSelectionChange([...selectedItems, item]);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const newList = [...selectedItems];
    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
    onSelectionChange(newList);
  };

  const handleMoveDown = (index: number) => {
    if (index >= selectedItems.length - 1) return;
    const newList = [...selectedItems];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    onSelectionChange(newList);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      {/* Chip grid */}
      {items.length === 0 && emptyText ? (
        <Text style={styles.emptyText}>{emptyText}</Text>
      ) : (
      <View style={styles.chipContainer}>
        {items.map((item) => {
          const selected = isSelected(item);
          const disabled = !selected && isMaxReached;
          const itemLabel = labelExtractor(item);

          return (
            <TouchableOpacity
              key={keyExtractor(item)}
              style={[
                styles.chip,
                selected && styles.chipSelected,
                disabled && styles.chipDisabled,
              ]}
              onPress={() => handlePress(item)}
              disabled={disabled}
              accessibilityLabel={itemLabel}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {itemLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      )}

      {/* Priority list */}
      {selectedItems.length > 0 && (
        <View style={styles.priorityContainer}>
          {selectedItems.map((item, index) => {
            const itemLabel = labelExtractor(item);
            return (
              <View key={keyExtractor(item)} style={styles.priorityRow}>
                <Text style={styles.priorityText}>
                  {index + 1}. {itemLabel}
                </Text>
                <View style={styles.priorityActions}>
                  {index > 0 && (
                    <TouchableOpacity
                      onPress={() => handleMoveUp(index)}
                      accessibilityLabel={`上移${itemLabel}`}
                      style={styles.moveButton}
                    >
                      <Text style={styles.moveButtonText}>↑</Text>
                    </TouchableOpacity>
                  )}
                  {index < selectedItems.length - 1 && (
                    <TouchableOpacity
                      onPress={() => handleMoveDown(index)}
                      accessibilityLabel={`下移${itemLabel}`}
                      style={styles.moveButton}
                    >
                      <Text style={styles.moveButtonText}>↓</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Error message */}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
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
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    fontSize: 14,
    color: '#333',
  },
  chipTextSelected: {
    color: '#fff',
  },
  priorityContainer: {
    marginTop: 12,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  priorityText: {
    fontSize: 14,
    color: '#333',
  },
  priorityActions: {
    flexDirection: 'row',
    gap: 8,
  },
  moveButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e8e8e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: '#e74c3c',
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
});
