export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

export interface ApiRequestConfig {
  signal?: AbortSignal;
  params?: Record<string, string | number | boolean | undefined>;
}

export type ApiStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  status: ApiStatus;
  data: T | null;
  error: string | null;
}
