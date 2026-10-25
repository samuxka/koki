import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const memoryFallback: Record<string, string> = {};

export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return typeof window !== 'undefined' ? localStorage.getItem(key) : memoryFallback[key] || null;
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return memoryFallback[key] || null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') localStorage.setItem(key, value);
        memoryFallback[key] = value;
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch {
      memoryFallback[key] = value;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') localStorage.removeItem(key);
        delete memoryFallback[key];
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      delete memoryFallback[key];
    }
  },
};
