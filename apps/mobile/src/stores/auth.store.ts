import { create } from 'zustand';
import { User, Company } from '@koki/types';
import { api } from '../services/api';
import { storage } from '../utils/storage';

interface AuthState {
  user: User | null;
  company: Company | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsOnboarding: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setCompany: (company: Company) => Promise<void>;
  refreshCompany: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  company: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  needsOnboarding: false,

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const token = await storage.getItem('koki_access_token');
      if (!token) {
        set({ user: null, company: null, token: null, isAuthenticated: false, isLoading: false });
        return;
      }

      // Fetch user profile
      const user = await api.get<User>('/users/me');
      set({ user, token, isAuthenticated: true });

      // If user has a current company, fetch company details
      if (user.currentCompanyId) {
        await storage.setItem('koki_current_company_id', user.currentCompanyId);
        try {
          const company = await api.get<Company>('/companies/current');
          set({ company, needsOnboarding: false });
        } catch {
          set({ needsOnboarding: true });
        }
      } else {
        set({ needsOnboarding: true });
      }
    } catch {
      await storage.removeItem('koki_access_token');
      await storage.removeItem('koki_refresh_token');
      set({ user: null, company: null, token: null, isAuthenticated: false, needsOnboarding: false });
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const data = await api.post<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; email: string; currentCompanyId?: string | null };
      }>('/auth/login', { email, password });

      await storage.setItem('koki_access_token', data.accessToken);
      await storage.setItem('koki_refresh_token', data.refreshToken);

      if (data.user.currentCompanyId) {
        await storage.setItem('koki_current_company_id', data.user.currentCompanyId);
      }

      set({ token: data.accessToken, isAuthenticated: true });
      await get().checkAuth();
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (fullName, email, password, phone) => {
    set({ isLoading: true });
    try {
      const data = await api.post<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; email: string };
      }>('/auth/register', { fullName, email, password, phone });

      await storage.setItem('koki_access_token', data.accessToken);
      await storage.setItem('koki_refresh_token', data.refreshToken);

      set({ token: data.accessToken, isAuthenticated: true, needsOnboarding: true });
      await get().checkAuth();
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      const refreshToken = await storage.getItem('koki_refresh_token');
      await api.post('/auth/logout', { refreshToken }).catch(() => {});
    } finally {
      await storage.removeItem('koki_access_token');
      await storage.removeItem('koki_refresh_token');
      await storage.removeItem('koki_current_company_id');
      set({
        user: null,
        company: null,
        token: null,
        isAuthenticated: false,
        needsOnboarding: false,
        isLoading: false,
      });
    }
  },

  setCompany: async (company: Company) => {
    await storage.setItem('koki_current_company_id', company.id);
    set({ company, needsOnboarding: false });
  },

  refreshCompany: async () => {
    try {
      const company = await api.get<Company>('/companies/current');
      set({ company });
    } catch {}
  },
}));
