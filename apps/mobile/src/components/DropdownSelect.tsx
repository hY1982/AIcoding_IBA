import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';

interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownSelectProps {
  options: DropdownOption[];
  selectedValue: string | null;
  placeholder: string;
  label: string;
  onSelect: (value: string) => void;
  error?: string;
  disabled?: boolean;
  emptyMessage?: string;
}

export function DropdownSelect({
  options,
  selectedValue,
  placeholder,
  label,
  onSelect,
  error,
  disabled = false,
  emptyMessage,
}: DropdownSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedLabel = options.find((o) => o.value === selectedValue)?.label;

  const handleSelect = (value: string) => {
    onSelect(value);
    setIsOpen(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        style={[styles.trigger, disabled && styles.triggerDisabled, error ? styles.triggerError : null]}
        onPress={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        accessibilityLabel={selectedLabel || placeholder}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
      >
        <Text style={[styles.triggerText, !selectedValue && styles.placeholderText]}>
          {selectedLabel || placeholder}
        </Text>
        <Text style={styles.arrow}>▼</Text>
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal visible={isOpen} transparent animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
          accessibilityLabel="关闭下拉"
        >
          <View style={styles.dropdown}>
            {options.length === 0 && emptyMessage ? (
              <Text style={styles.emptyMessage}>{emptyMessage}</Text>
            ) : (
              <FlatList
                data={options}
                keyExtractor={(item) => item.value}
                renderItem={({ item }) => {
                  const isSelected = item.value === selectedValue;
                  return (
                    <TouchableOpacity
                      style={[styles.option, isSelected && styles.optionSelected]}
                      onPress={() => handleSelect(item.value)}
                      accessibilityLabel={item.label}
                      accessibilityRole="checkbox"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          isSelected && styles.optionTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
                bounces={false}
                showsVerticalScrollIndicator
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  triggerDisabled: {
    backgroundColor: '#f5f5f5',
    opacity: 0.6,
  },
  triggerError: {
    borderColor: '#e74c3c',
  },
  triggerText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  arrow: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: '#e74c3c',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  dropdown: {
    width: '80%',
    maxHeight: 300,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 4,
    elevation: 5,
    boxShadow: '0px 4px 12px rgba(0,0,0,0.15)',
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionSelected: {
    backgroundColor: '#e8f0fe',
  },
  optionText: {
    fontSize: 15,
    color: '#333',
  },
  optionTextSelected: {
    color: '#1a73e8',
    fontWeight: '600',
  },
  emptyMessage: {
    padding: 16,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
