import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { storage } from '../utils/storage';

function getApiBaseUrl(): string {
  // 1. Environment variable if provided during build or runtime
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Dynamically resolve host from Expo packager connection (works seamlessly in Expo Go and dev clients)
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:3333/api/v1`;
    }
  }

  // 3. Standalone APK on physical device on the local network
  if (Platform.OS === 'android') {
    return 'http://192.168.1.118:3333/api/v1';
  }
  return 'http://localhost:3333/api/v1';
}

const API_BASE_URL = getApiBaseUrl();

class ApiClient {
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];
  private inflightGetRequests = new Map<string, Promise<any>>();

  private async getHeaders(): Promise<HeadersInit> {
    const syncToken = storage.getItemSync('koki_access_token');
    const syncCompanyId = storage.getItemSync('koki_current_company_id');

    const [token, companyId] =
      syncToken !== undefined && syncCompanyId !== undefined
        ? [syncToken, syncCompanyId]
        : await Promise.all([
            storage.getItem('koki_access_token'),
            storage.getItem('koki_current_company_id'),
          ]);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (companyId) {
      headers['x-company-id'] = companyId;
    }

    return headers;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const method = (options.method || 'GET').toUpperCase();

    // Deduplicate concurrent identical GET requests
    if (method === 'GET') {
      const existing = this.inflightGetRequests.get(url);
      if (existing) {
        return existing as Promise<T>;
      }
      const promise = this.executeRequest<T>(endpoint, url, options).finally(() => {
        this.inflightGetRequests.delete(url);
      });
      this.inflightGetRequests.set(url, promise);
      return promise;
    }

    return this.executeRequest<T>(endpoint, url, options);
  }

  private async executeRequest<T>(
    endpoint: string,
    url: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers = await this.getHeaders();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: options.signal || controller.signal,
        headers: {
          ...headers,
          ...(options.headers || {}),
        },
      });
      clearTimeout(timeoutId);

      // Handle 401 Unauthorized for Refresh Token rotation
      if (response.status === 401 && !endpoint.includes('/auth/')) {
        const refreshedToken = await this.handleTokenRefresh();
        if (refreshedToken) {
          const retryHeaders = await this.getHeaders();
          const retryResponse = await fetch(url, {
            ...options,
            headers: {
              ...retryHeaders,
              ...(options.headers || {}),
            },
          });
          return this.parseResponse<T>(retryResponse);
        }
      }

      return this.parseResponse<T>(response);
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err?.name === 'AbortError') {
        throw new Error('Tempo limite de conexão excedido. Verifique sua rede.');
      }
      throw err;
    }
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Resposta do servidor inválida (${response.status})`);
    }

    if (!response.ok) {
      const message =
        (Array.isArray(json.message) ? json.message.join(', ') : json.message) ||
        json.error ||
        `Erro ${response.status}`;
      throw new Error(message);
    }

    // Extract payload from standardized { success: true, data: T }
    return json.data !== undefined ? json.data : json;
  }

  private async handleTokenRefresh(): Promise<string | null> {
    if (this.isRefreshing) {
      return new Promise((resolve) => {
        this.refreshSubscribers.push(resolve);
      });
    }

    this.isRefreshing = true;
    try {
      const refreshToken = await storage.getItem('koki_refresh_token');
      if (!refreshToken) {
        return null;
      }

      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        await Promise.all([
          storage.removeItem('koki_access_token'),
          storage.removeItem('koki_refresh_token'),
        ]);
        return null;
      }

      const data = await res.json();
      const payload = data.data || data;
      await storage.setItem('koki_access_token', payload.accessToken);
      if (payload.refreshToken) {
        await storage.setItem('koki_refresh_token', payload.refreshToken);
      }

      this.refreshSubscribers.forEach((callback) => callback(payload.accessToken));
      this.refreshSubscribers = [];
      return payload.accessToken;
    } catch {
      return null;
    } finally {
      this.isRefreshing = false;
    }
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
