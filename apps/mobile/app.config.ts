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
  const plaidUniversalLinkDomain =
    process.env.EXPO_PUBLIC_PLAID_UNIVERSAL_LINK_DOMAIN ?? 'ledgr-henna.vercel.app';

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
      associatedDomains: [`applinks:${plaidUniversalLinkDomain}`],
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
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
    updates: {
      url: 'https://u.expo.dev/2f7b00cb-4081-478c-80d2-521ec553e02a',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    plugins: [
      'expo-font',
      'expo-secure-store',
      'expo-web-browser',
      [
        'expo-local-authentication',
        {
          faceIDPermission: 'Allow LEDGR to use Face ID to unlock the app.',
        },
      ],
      './plugins/with-path-safe-ios-scripts',
    ],
    extra: {
      eas: {
        projectId: '2f7b00cb-4081-478c-80d2-521ec553e02a',
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
      supabaseRedirectUrl: process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL,
    },
  };
};
