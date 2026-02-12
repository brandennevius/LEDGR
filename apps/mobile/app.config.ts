import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';

type ConfigContext = {
  config: ExpoConfig;
};

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    name: 'Financial Coaching',
    slug: 'financial-coaching',
    scheme: 'financialcoaching',
    version: config.version ?? '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0B0F1E',
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0B0F1E',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: ['expo-secure-store', 'expo-web-browser'],
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    },
  };
};
