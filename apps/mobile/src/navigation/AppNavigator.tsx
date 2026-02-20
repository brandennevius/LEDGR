import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';

import { CoachChatFab } from '../components/CoachChatFab';
import { AccountsScreen } from '../screens/AccountsScreen';
import { CategoriesScreen } from '../screens/CategoriesScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { DistributionScreen } from '../screens/DistributionScreen';
import { GoalsScreen } from '../screens/GoalsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { colors, navigationTheme } from '../theme';

const FACE_ID_REQUIRED_KEY = 'settings.faceIdRequired';

const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        tabBarShowLabel: false,
        headerShown: true,
        headerTransparent: false,
        headerStyle: styles.headerBar,
        headerShadowVisible: false,
        headerTitleAlign: 'center',
        headerTitle: () => <Text style={styles.headerTitle}>LEDGR</Text>,
        headerLeft: () => (
          <Pressable
            onPress={() =>
              route.name === 'Settings'
                ? navigation.navigate('Dashboard')
                : navigation.navigate('Settings')
            }
            style={styles.headerIconButton}
          >
            <Ionicons
              name={route.name === 'Settings' ? 'settings' : 'settings-outline'}
              size={20}
              color={colors.chromeText}
            />
          </Pressable>
        ),
        headerRight: () => <CoachChatFab variant="icon" />,
        headerLeftContainerStyle: styles.headerSideContainer,
        headerRightContainerStyle: styles.headerSideContainer,
        tabBarStyle: {
          backgroundColor: colors.chrome,
          borderTopColor: colors.cardBorder,
          height: 64,
          display: route.name === 'Settings' ? 'none' : 'flex',
        },
        tabBarActiveTintColor: colors.primary as unknown as string,
        tabBarInactiveTintColor: colors.textMuted as unknown as string,
        tabBarIcon: ({ color, size }) => {
          const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
            Dashboard: 'grid',
            Distribution: 'analytics',
            Transactions: 'swap-vertical',
            Goals: 'flag',
            Accounts: 'wallet',
            Categories: 'layers',
          };
          const name = iconMap[route.name] ?? 'ellipse';
          return <Ionicons name={name} size={size ?? 22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Distribution" component={DistributionScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Goals" component={GoalsScreen} />
      <Tab.Screen name="Accounts" component={AccountsScreen} />
      <Tab.Screen name="Categories" component={CategoriesScreen} />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarButton: () => null }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const [isLocked, setIsLocked] = useState(false);
  const [checkingLock, setCheckingLock] = useState(true);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const authenticateIfRequired = async (mode: 'boot' | 'resume') => {
    const enabled = (await AsyncStorage.getItem(FACE_ID_REQUIRED_KEY)) === 'true';

    if (!enabled) {
      setIsLocked(false);
      setCheckingLock(false);
      return;
    }

    if (mode === 'resume') {
      setIsLocked(true);
    }

    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      setIsLocked(false);
      setCheckingLock(false);
      await AsyncStorage.setItem(FACE_ID_REQUIRED_KEY, 'false');
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock LEDGR',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    setIsLocked(!result.success);
    setCheckingLock(false);
  };

  useEffect(() => {
    authenticateIfRequired('boot');

    const sub = AppState.addEventListener('change', (nextState) => {
      const previousState = appState.current;
      appState.current = nextState;

      if (previousState.match(/inactive|background/) && nextState === 'active') {
        authenticateIfRequired('resume');
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  return (
    <NavigationContainer theme={navigationTheme}>
      <View style={styles.container}>
        <MainTabs />
        {!checkingLock && isLocked ? (
          <View style={styles.lockOverlay}>
            <Text style={styles.lockTitle}>Locked</Text>
            <Text style={styles.lockSubtitle}>Use Face ID to continue.</Text>
            <Pressable style={styles.unlockButton} onPress={() => authenticateIfRequired('resume')}>
              <Text style={styles.unlockLabel}>Unlock</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    backgroundColor: colors.chrome,
  },
  headerTitle: {
    color: colors.chromeText,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.chromeButtonBorder,
    backgroundColor: colors.chromeButtonBg,
  },
  headerSideContainer: {
    paddingHorizontal: 12,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 8, 22, 0.93)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  lockTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
  },
  lockSubtitle: {
    color: colors.textMuted,
    fontSize: 15,
    marginTop: 8,
    marginBottom: 18,
  },
  unlockButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  unlockLabel: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '700',
  },
});
