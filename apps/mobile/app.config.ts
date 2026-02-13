import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';

type ConfigContext = {
  config: ExpoConfig;
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const bundleIdentifier =
    process.env.EXPO_IOS_BUNDLE_IDENTIFIER ?? 'com.brandennevius.ledgr';
  const androidPackage =
    process.env.EXPO_ANDROID_PACKAGE ?? 'com.brandennevius.ledgr';

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
      bundleIdentifier,
    },
    android: {
      package: androidPackage,
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
    plugins: [
      'expo-secure-store',
      'expo-web-browser',
      './plugins/with-path-safe-ios-scripts',
    ],
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
      supabaseRedirectUrl: process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL,
    },
  };
};
