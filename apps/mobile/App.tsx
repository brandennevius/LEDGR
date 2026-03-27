import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AuthScreen } from './src/screens/AuthScreen';
import { LoadingScreen } from './src/screens/LoadingScreen';
import { PolicyConsentScreen } from './src/screens/PolicyConsentScreen';
import { apiRequest } from './src/lib/api';

WebBrowser.maybeCompleteAuthSession();

function RootNavigator() {
  const { session, initializing } = useAuth();
  const [policyState, setPolicyState] = useState<{
    userId: string;
    accepted: boolean;
  } | null>(null);
  const sessionUserId = session?.user?.id ?? null;

  useEffect(() => {
    let mounted = true;
    if (!session) {
      return () => {
        mounted = false;
      };
    }

    apiRequest<{ requiresAcceptance?: boolean }>('/api/policies/status')
      .then((data) => {
        if (!mounted) return;
        setPolicyState({
          userId: session.user.id,
          accepted: !data.requiresAcceptance,
        });
      })
      .catch(() => {
        if (!mounted) return;
        setPolicyState({
          userId: session.user.id,
          accepted: false,
        });
      });

    return () => {
      mounted = false;
    };
  }, [session]);

  if (initializing) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (!sessionUserId || policyState?.userId !== sessionUserId) {
    return <LoadingScreen />;
  }

  if (!policyState.accepted) {
    return (
      <PolicyConsentScreen
        onAccepted={() =>
          setPolicyState({
            userId: sessionUserId,
            accepted: true,
          })
        }
      />
    );
  }

  return <AppNavigator userId={sessionUserId} />;
}

export default function App() {
  useEffect(() => {
    const loadTheme = async () => {
      const stored = await AsyncStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark') {
        Appearance.setColorScheme(stored);
      } else {
        await AsyncStorage.setItem('theme', 'light');
        Appearance.setColorScheme('light');
      }
    };
    loadTheme();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="auto" />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
