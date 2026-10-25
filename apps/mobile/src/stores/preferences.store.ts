import { create } from 'zustand';
import { storage } from '../utils/storage';
import { api } from '../services/api';

interface PreferencesState {
  hideValues: boolean;
  toggleHideValues: () => Promise<void>;
  loadPreferences: () => Promise<void>;
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  hideValues: false,

  loadPreferences: async () => {
    const stored = await storage.getItem('koki_pref_hide_values');
    if (stored !== null) {
      set({ hideValues: stored === 'true' });
    }
  },

  toggleHideValues: async () => {
    const next = !get().hideValues;
    set({ hideValues: next });
    await storage.setItem('koki_pref_hide_values', String(next));
    // Persist to backend asynchronously
    api.put('/users/me/preferences', { hideValues: next }).catch(() => {});
  },
}));
