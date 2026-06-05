import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { RoleSelectScreenNavigationProp } from '@/navigation/types';

export function RoleSelectScreen() {
  const navigation = useNavigation<RoleSelectScreenNavigationProp>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>篮球匹配平台</Text>
      <Text style={styles.subtitle}>请选择您的角色</Text>

      <TouchableOpacity
        style={styles.roleButton}
        onPress={() => navigation.navigate('Register', { userType: 'player' })}
        accessibilityLabel="选择球员角色"
        accessibilityRole="button"
      >
        <Text style={styles.roleButtonText}>我是球员</Text>
        <Text style={styles.roleDescription}>寻找比赛，匹配队友</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.roleButton, styles.venueButton]}
        onPress={() => navigation.navigate('Register', { userType: 'venue_manager' })}
        accessibilityLabel="选择场地方角色"
        accessibilityRole="button"
      >
        <Text style={styles.roleButtonText}>我是场地方</Text>
        <Text style={styles.roleDescription}>管理场地，发布时段</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.loginLink}
        onPress={() => navigation.navigate('Login')}
        accessibilityLabel="已有账号，去登录"
        accessibilityRole="button"
      >
        <Text style={styles.loginLinkText}>已有账号？去登录</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  roleButton: {
    width: '100%',
    backgroundColor: '#3498db',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  venueButton: {
    backgroundColor: '#2ecc71',
  },
  roleButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  roleDescription: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    marginTop: 4,
  },
  loginLink: {
    marginTop: 24,
  },
  loginLinkText: {
    color: '#3498db',
    fontSize: 14,
  },
});
