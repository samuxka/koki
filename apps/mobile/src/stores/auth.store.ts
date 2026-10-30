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
    try {
      // 1. Read token and cached session in parallel from storage
      const [token, cachedUserStr, cachedCompanyStr, savedCompanyId] = await Promise.all([
        storage.getItem('koki_access_token'),
        storage.getItem('koki_cached_user'),
        storage.getItem('koki_cached_company'),
        storage.getItem('koki_current_company_id'),
      ]);

      if (!token) {
        set({
          user: null,
          company: null,
          token: null,
          isAuthenticated: false,
          needsOnboarding: false,
          isLoading: false,
        });
        return;
      }

      // 2. Instant Hydration (<100ms): if we have cached user/company, unblock UI immediately!
      let hydratedFromCache = false;
      if (cachedUserStr) {
        try {
          const cachedUser: User = JSON.parse(cachedUserStr);
          const cachedCompany: Company | null = cachedCompanyStr ? JSON.parse(cachedCompanyStr) : null;
          hydratedFromCache = true;
          set({
            user: cachedUser,
            company: cachedCompany,
            token,
            isAuthenticated: true,
            needsOnboarding: !cachedUser.currentCompanyId && !cachedCompany,
            isLoading: false,
          });
        } catch {}
      }

      if (!hydratedFromCache) {
        set({ isLoading: true });
      }

      // 3. Revalidate user & company in parallel (if companyId is known) or swiftly
      const userPromise = api.get<User>('/users/me');
      const companyPromise = savedCompanyId
        ? api.get<Company>('/companies/current').catch(() => null)
        : Promise.resolve(null);

      const [user, initialCompany] = await Promise.all([userPromise, companyPromise]);

      await storage.setItem('koki_cached_user', JSON.stringify(user));

      if (user.currentCompanyId) {
        await storage.setItem('koki_current_company_id', user.currentCompanyId);
        let company = initialCompany;
        if (!company || company.id !== user.currentCompanyId) {
          try {
            company = await api.get<Company>('/companies/current');
          } catch {
            company = null;
          }
        }

        if (company) {
          await storage.setItem('koki_cached_company', JSON.stringify(company));
          set({
            user,
            company,
            token,
            isAuthenticated: true,
            needsOnboarding: false,
            isLoading: false,
          });
        } else {
          set({
            user,
            company: null,
            token,
            isAuthenticated: true,
            needsOnboarding: true,
            isLoading: false,
          });
        }
      } else {
        set({
          user,
          company: null,
          token,
          isAuthenticated: true,
          needsOnboarding: true,
          isLoading: false,
        });
      }
    } catch (err: any) {
      // Only wipe session if unauthorized or if we had no cached hydration
      const isAuthError =
        err?.message?.includes('401') ||
        err?.message?.includes('Não autenticado') ||
        err?.message?.includes('expirado') ||
        err?.message?.includes('inválido');

      if (isAuthError || !get().user) {
        await Promise.all([
          storage.removeItem('koki_access_token'),
          storage.removeItem('koki_refresh_token'),
          storage.removeItem('koki_cached_user'),
          storage.removeItem('koki_cached_company'),
        ]);
        set({
          user: null,
          company: null,
          token: null,
          isAuthenticated: false,
          needsOnboarding: false,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
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

      await Promise.all([
        storage.setItem('koki_access_token', data.accessToken),
        storage.setItem('koki_refresh_token', data.refreshToken),
        ...(data.user.currentCompanyId
          ? [storage.setItem('koki_current_company_id', data.user.currentCompanyId)]
          : []),
      ]);

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

      await Promise.all([
        storage.setItem('koki_access_token', data.accessToken),
        storage.setItem('koki_refresh_token', data.refreshToken),
      ]);

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
      await Promise.all([
        storage.removeItem('koki_access_token'),
        storage.removeItem('koki_refresh_token'),
        storage.removeItem('koki_current_company_id'),
        storage.removeItem('koki_cached_user'),
        storage.removeItem('koki_cached_company'),
      ]);
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
    await Promise.all([
      storage.setItem('koki_current_company_id', company.id),
      storage.setItem('koki_cached_company', JSON.stringify(company)),
    ]);
    set({ company, needsOnboarding: false });
  },

  refreshCompany: async () => {
    try {
      const company = await api.get<Company>('/companies/current');
      await storage.setItem('koki_cached_company', JSON.stringify(company));
      set({ company });
    } catch {}
  },
}));
