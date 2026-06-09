import React, { ReactNode } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

interface FormContainerProps {
  children: ReactNode;
  onSubmit: () => void;
  submitLabel: string;
  isLoading?: boolean;
  error?: string;
  success?: string;
}

export function FormContainer({
  children,
  onSubmit,
  submitLabel,
  isLoading = false,
  error,
  success,
}: FormContainerProps) {
  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
      <View style={styles.form}>
        {children}

        {success ? (
          <Text style={styles.globalSuccess} accessibilityLiveRegion="assertive">
            {success}
          </Text>
        ) : null}

        {error ? (
          <Text style={styles.globalError} accessibilityLiveRegion="assertive">
            {error}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[styles.submitButton, isLoading ? styles.submitButtonDisabled : null]}
          onPress={onSubmit}
          disabled={isLoading}
          accessibilityLabel={submitLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled: isLoading }}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>{submitLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  form: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  submitButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#a0c4e8',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  globalError: {
    color: '#e74c3c',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  globalSuccess: {
    color: '#27ae60',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
});
