import { Platform } from 'react-native';
import Constants from 'expo-constants';

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
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
};

export async function apiRequest<T>(path: string, options?: ApiRequestOptions): Promise<T> {
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
    try {
      payload = await response.json();
      if (!payload.status) {
        payload.status = response.status;
      }
    } catch {
      // ignore JSON parsing errors
    }
    throw payload;
  }

  return response.json() as Promise<T>;
}
