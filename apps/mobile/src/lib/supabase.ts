import 'react-native-url-polyfill/auto';

import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import {
  getSecureJsonString,
  removeSecureJsonString,
  setSecureJsonString,
} from './secureStorage';

type SecureStoreAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const secureStore: SecureStoreAdapter = {
  getItem: async (key) => {
    return getSecureJsonString(key);
  },
  setItem: async (key, value) => {
    await setSecureJsonString(key, value);
  },
  removeItem: async (key) => {
    await removeSecureJsonString(key);
  },
};

const supabaseUrl =
  Constants.expoConfig?.extra?.supabaseUrl ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  '';

const supabaseAnonKey =
  Constants.expoConfig?.extra?.supabaseAnonKey ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase config. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
