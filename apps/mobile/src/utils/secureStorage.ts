import * as SecureStore from 'expo-secure-store';

const isWeb = typeof window !== 'undefined' && typeof window.document !== 'undefined';

/**
 * 跨平台安全存储封装
 * - iOS/Android: 使用 expo-secure-store
 * - Web: 降级使用 localStorage（开发调试用途）
 */
export const secureStorage = {
  async setItemAsync(key: string, value: string): Promise<void> {
    if (isWeb) {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },

  async getItemAsync(key: string): Promise<string | null> {
    if (isWeb) {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },

  async deleteItemAsync(key: string): Promise<void> {
    if (isWeb) {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
