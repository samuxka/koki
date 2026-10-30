import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// In-memory cache eliminates repeated Android Keystore / Native Bridge roundtrips on every API request
const memoryCache = new Map<string, string | null>();
const memoryFallback: Record<string, string> = {};

export const storage = {
  getItemSync(key: string): string | null | undefined {
    if (memoryCache.has(key)) {
      return memoryCache.get(key) ?? null;
    }
    return undefined;
  },

  async getItem(key: string): Promise<string | null> {
    if (memoryCache.has(key)) {
      return memoryCache.get(key) ?? null;
    }
    try {
      if (Platform.OS === 'web') {
        const val =
          typeof window !== 'undefined' ? localStorage.getItem(key) : memoryFallback[key] || null;
        memoryCache.set(key, val);
        return val;
      }
      const val = await SecureStore.getItemAsync(key);
      memoryCache.set(key, val);
      return val;
    } catch {
      const fallback = memoryFallback[key] || null;
      memoryCache.set(key, fallback);
      return fallback;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    memoryCache.set(key, value);
    memoryFallback[key] = value;
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') localStorage.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Value already stored in memoryCache & memoryFallback
    }
  },

  async removeItem(key: string): Promise<void> {
    memoryCache.set(key, null);
    delete memoryFallback[key];
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') localStorage.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Already removed from memoryCache
    }
  },
};
