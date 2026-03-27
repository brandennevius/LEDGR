import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { buildDemoChatResponse, handleDemoApiRequest, isDemoSupportedPath } from './demoData';
import { getDemoModeEnabled } from './demoMode';
import { supabase } from './supabase';

const resolvedBaseUrl =
  Constants.expoConfig?.extra?.apiBaseUrl ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  process.env.EXPO_PUBLIC_API_URL ??
  '';

const fallbackBaseUrl =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000'
    : 'http://localhost:3000';

const baseUrl = resolvedBaseUrl || fallbackBaseUrl;

if (!resolvedBaseUrl) {
  console.warn(
    'Missing EXPO_PUBLIC_API_BASE_URL for mobile API client. Falling back to localhost.'
  );
}

export type ApiError = {
  error: string;
  status: number;
};

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
};

export async function apiRequest<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  if ((await getDemoModeEnabled()) && isDemoSupportedPath(path)) {
    return handleDemoApiRequest<T>(path, {
      method: options?.method ?? 'GET',
      body: options?.body,
    });
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const method = options?.method ?? 'GET';
  const hasBody = options?.body !== undefined;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(hasBody ? { body: JSON.stringify(options?.body ?? null) } : {}),
  });

  if (!response.ok) {
    let payload: ApiError = { error: 'Request failed', status: response.status };
    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      try {
        payload = await response.json();
        if (!payload.status) {
          payload.status = response.status;
        }
      } catch {
        // ignore JSON parsing errors
      }
    } else {
      try {
        const raw = await response.text();
        if (raw.includes('Authentication Required') && raw.includes('Vercel')) {
          payload = {
            error:
              'API deployment is protected by Vercel authentication. Set EXPO_PUBLIC_API_BASE_URL to a public deployment.',
            status: response.status,
          };
        } else if (raw.trim().length > 0) {
          payload = {
            error: raw.trim().slice(0, 200),
            status: response.status,
          };
        }
      } catch {
        // ignore text parsing errors
      }
    }
    throw payload;
  }

  return response.json() as Promise<T>;
}

type ApiStreamOptions = {
  path: string;
  body: unknown;
  onChunk: (chunk: string) => void;
};

export async function apiStreamRequest({
  path,
  body,
  onChunk,
}: ApiStreamOptions): Promise<void> {
  if ((await getDemoModeEnabled()) && path === '/api/insights/chat') {
    const response = buildDemoChatResponse(body);
    const answer = response.answer ?? 'No insight available yet.';
    const chunks = answer.match(/.{1,80}(\s|$)|\S+/g) ?? [answer];
    chunks.forEach((chunk) => onChunk(chunk));
    return;
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let processed = 0;

    xhr.open('POST', `${baseUrl}${path}`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.onprogress = () => {
      const next = xhr.responseText.slice(processed);
      if (!next) return;
      processed = xhr.responseText.length;
      onChunk(next);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const next = xhr.responseText.slice(processed);
        if (next) onChunk(next);
        resolve();
        return;
      }

      try {
        const parsed = JSON.parse(xhr.responseText) as ApiError;
        reject(parsed);
      } catch {
        reject({ error: 'Streaming request failed', status: xhr.status } as ApiError);
      }
    };

    xhr.onerror = () => {
      reject({ error: 'Network error during streaming request', status: 0 } as ApiError);
    };

    xhr.send(JSON.stringify(body));
  });
}
