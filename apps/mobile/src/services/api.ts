import type { AnalyzeRequest, AnalyzeResponse } from '@sentinel/contracts';

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ClientConfig {
  baseUrl: string;
  apiKey?: string;
}

const clean = (url: string) => url.trim().replace(/\/+$/, '');

async function request<T>(cfg: ClientConfig, path: string, init: RequestInit = {}, timeoutMs = 8000): Promise<T> {
  if (!cfg.baseUrl) throw new ApiError('No backend URL configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${clean(cfg.baseUrl)}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(cfg.apiKey ? { 'X-API-Key': cfg.apiKey } : {}),
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      throw new ApiError(res.status === 403 ? 'API key rejected (403)' : `Server error (${res.status})`, res.status);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof Error && e.name === 'AbortError') throw new ApiError('Request timed out');
    throw new ApiError('Cannot reach the server. Check the URL and your connection.');
  } finally {
    clearTimeout(timer);
  }
}

export function analyzeOnline(cfg: ClientConfig, payload: AnalyzeRequest): Promise<AnalyzeResponse> {
  return request<AnalyzeResponse>(cfg, '/api/v1/analyze/', { method: 'POST', body: JSON.stringify(payload) }, 12000);
}

export interface HealthInfo {
  status: string;
  database: string;
  ai_provider: string;
  ai_configured: boolean;
  api_key_required: boolean;
}

export async function checkHealth(cfg: ClientConfig): Promise<{ info: HealthInfo; ms: number }> {
  const t0 = Date.now();
  const info = await request<HealthInfo>(cfg, '/api/health/', { method: 'GET' }, 15000); // free hosts cold-start slowly
  return { info, ms: Date.now() - t0 };
}
