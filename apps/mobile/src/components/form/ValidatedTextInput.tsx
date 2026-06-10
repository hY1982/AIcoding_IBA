import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, TextInputProps } from 'react-native';

interface ValidatedTextInputProps extends Omit<
  TextInputProps,
  'value' | 'onChangeText' | 'editable'
> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  accessibilityLabel: string;
  disabled?: boolean;
}

export function ValidatedTextInput({
  label,
  value,
  onChangeText,
  error,
  accessibilityLabel,
  secureTextEntry,
  disabled,
  ...textInputProps
}: ValidatedTextInputProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const isSecure = secureTextEntry && !isPasswordVisible;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            error ? styles.inputError : null,
            disabled ? styles.inputDisabled : null,
          ]}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isSecure}
          editable={!disabled}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="text"
          accessibilityState={{ disabled: !!disabled }}
          {...textInputProps}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible((prev) => !prev)}
            style={styles.toggleButton}
            accessibilityLabel={isPasswordVisible ? '隐藏密码' : '显示密码'}
          >
            <Text style={styles.toggleText}>{isPasswordVisible ? '隐藏' : '显示'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <Text style={styles.errorText} accessibilityLiveRegion="assertive">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    textAlign: 'left',
    includeFontPadding: false,
    paddingRight: 16,
  },
  inputError: {
    borderColor: '#e74c3c',
  },
  inputDisabled: {
    backgroundColor: '#f0f0f0',
    color: '#999',
  },
  toggleButton: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  toggleText: {
    color: '#3498db',
    fontSize: 14,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: 4,
  },
});
