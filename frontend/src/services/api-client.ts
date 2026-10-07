import type { ApiRequestConfig, ApiResponse, PaginatedResponse } from '@/types/api';
import { useAuthStore } from '@/stores/useAuthStore';

/**
 * API client for the FastAPI backend.
 * It automatically injects the current Supabase access token into every request.
 */

const MOCK_LATENCY_MS = 400;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

function delay(ms: number = MOCK_LATENCY_MS, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

export interface RequestOptions extends ApiRequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  await delay();

  const token = useAuthStore.getState().token;
  const url = new URL(`${API_BASE_URL}${endpoint}`, window.location.origin);
  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, String(value));
    });
  }

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url.toString(), {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail ?? payload.error ?? `API error: ${response.status}`);
  }

  return {
    data: payload.data ?? payload as unknown as T,
    success: true,
    message: payload.message,
  };
}

export async function apiGet<T>(endpoint: string, config?: ApiRequestConfig): Promise<T> {
  const res = await apiRequest<T>(endpoint, { ...config, method: 'GET' });
  return res.data;
}

export async function apiPost<T>(endpoint: string, body?: unknown, config?: ApiRequestConfig): Promise<T> {
  const res = await apiRequest<T>(endpoint, { ...config, method: 'POST', body });
  return res.data;
}

export async function apiPut<T>(endpoint: string, body?: unknown, config?: ApiRequestConfig): Promise<T> {
  const res = await apiRequest<T>(endpoint, { ...config, method: 'PUT', body });
  return res.data;
}

export async function apiPatch<T>(endpoint: string, body?: unknown, config?: ApiRequestConfig): Promise<T> {
  const res = await apiRequest<T>(endpoint, { ...config, method: 'PATCH', body });
  return res.data;
}

export async function apiDelete<T>(endpoint: string, config?: ApiRequestConfig): Promise<T> {
  const res = await apiRequest<T>(endpoint, { ...config, method: 'DELETE' });
  return res.data;
}

export async function apiPaginated<T>(
  endpoint: string,
  page = 1,
  pageSize = 20,
  config?: ApiRequestConfig,
): Promise<PaginatedResponse<T>> {
  await delay();
  // Mock: services override this with real pagination
  return {
    data: [],
    total: 0,
    page,
    pageSize,
    hasNext: false,
  };
}

export { API_BASE_URL, delay };
