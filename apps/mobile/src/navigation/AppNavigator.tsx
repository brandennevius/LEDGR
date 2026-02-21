import { Ionicons } from '@expo/vector-icons';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import {
  NavigationContainer,
  type NavigationContainerRef,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

import { AppOnboardingOverlay } from '../components/AppOnboardingOverlay';
import { CoachChatFab } from '../components/CoachChatFab';
import { AppOnboardingProvider, type AppTabName } from '../context/AppOnboardingContext';
import { AccountsScreen } from '../screens/AccountsScreen';
import { CategoriesScreen } from '../screens/CategoriesScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { DistributionScreen } from '../screens/DistributionScreen';
import { GoalsScreen } from '../screens/GoalsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { colors, navigationTheme } from '../theme';

type TopTabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  Categories: undefined;
  Distribution: undefined;
  Goals: undefined;
  Accounts: undefined;
};

type RootStackParamList = {
  Tabs: NavigatorScreenParams<TopTabParamList>;
  Settings: undefined;
};

const TopTab = createMaterialTopTabNavigator<TopTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();
const chrome = colors.chrome as string;
const chromeText = colors.chromeText as string;
const cardBorder = colors.cardBorder as string;
const primary = colors.primary as string;
const text = colors.text as string;
const textMuted = colors.textMuted as string;

function MainTabs() {
  return (
    <TopTab.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        swipeEnabled: true,
        animationEnabled: true,
        tabBarScrollEnabled: true,
        tabBarItemStyle: styles.topTabItem,
        tabBarStyle: styles.topTabBar,
        tabBarIndicatorStyle: styles.topTabIndicator,
        tabBarActiveTintColor: text,
        tabBarInactiveTintColor: textMuted,
        tabBarPressColor: 'transparent',
        tabBarLabelStyle: styles.topTabLabel,
        lazy: true,
      }}
    >
      <TopTab.Screen name="Dashboard" component={DashboardScreen} />
      <TopTab.Screen name="Transactions" component={TransactionsScreen} />
      <TopTab.Screen name="Categories" component={CategoriesScreen} />
      <TopTab.Screen name="Distribution" component={DistributionScreen} options={{ title: 'Cash flow' }} />
      <TopTab.Screen name="Goals" component={GoalsScreen} />
      <TopTab.Screen name="Accounts" component={AccountsScreen} />
    </TopTab.Navigator>
  );
}

export function AppNavigator({ userId }: { userId: string }) {
  const [faceIdRequired, setFaceIdRequired] = useState(false);
  const [unlocked, setUnlocked] = useState(true);
  const appStateRef = useRef(AppState.currentState);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  const navigateToTab = useCallback((tab: AppTabName) => {
    navigationRef.current?.navigate('Tabs', { screen: tab });
  }, []);

  const promptUnlock = useCallback(async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) {
      setUnlocked(true);
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock LEDGR',
      fallbackLabel: 'Use device passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    setUnlocked(result.success);
  }, []);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem('settings.faceIdRequired')
      .then((value) => {
        if (!mounted) return;
        const enabled = value === 'true';
        setFaceIdRequired(enabled);
        if (!enabled) {
          setUnlocked(true);
          return;
        }
        setUnlocked(false);
        void promptUnlock();
      })
      .catch(() => {
        if (!mounted) return;
        setFaceIdRequired(false);
        setUnlocked(true);
      });
    return () => {
      mounted = false;
    };
  }, [promptUnlock]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (prev.match(/inactive|background/) && nextState === 'active') {
        const enabled = (await AsyncStorage.getItem('settings.faceIdRequired')) === 'true';
        setFaceIdRequired(enabled);
        if (enabled) {
          setUnlocked(false);
          void promptUnlock();
          return;
        }
        setUnlocked(true);
      }
    });
    return () => sub.remove();
  }, [promptUnlock]);

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}>
      <View style={styles.container}>
        <AppOnboardingProvider navigateToTab={navigateToTab} userId={userId}>
          <Stack.Navigator
            initialRouteName="Tabs"
            screenOptions={({ navigation }) => ({
              headerShown: true,
              headerShadowVisible: false,
              headerTitleAlign: 'center',
              headerStyle: styles.headerBar,
              headerTitle: () => <Text style={styles.headerTitle}>LEDGR</Text>,
              headerLeft: () => (
                <Pressable
                  onPress={() => {
                    if (navigation.getState().routes[navigation.getState().index]?.name === 'Settings') {
                      navigation.navigate('Tabs' as never);
                      return;
                    }
                    navigation.navigate('Settings' as never);
                  }}
                  style={styles.headerIconButton}
                >
                  <Ionicons
                    name={
                      navigation.getState().routes[navigation.getState().index]?.name === 'Settings'
                        ? 'settings'
                        : 'settings-outline'
                    }
                    size={20}
                    color={chromeText}
                  />
                </Pressable>
              ),
              headerRight: () => <CoachChatFab variant="icon" />,
              headerLeftContainerStyle: styles.headerSideContainer,
              headerRightContainerStyle: styles.headerSideContainer,
            })}
          >
            <Stack.Screen
              name="Tabs"
              component={MainTabs}
              options={{ headerTitle: () => <Text style={styles.headerTitle}>LEDGR</Text> }}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </Stack.Navigator>
          <AppOnboardingOverlay disabled={faceIdRequired && !unlocked} />
        </AppOnboardingProvider>
        {faceIdRequired && !unlocked ? (
          <View style={styles.lockOverlay}>
            <Text style={styles.lockTitle}>Face ID Required</Text>
            <Text style={styles.lockSubtitle}>Authenticate to continue.</Text>
            <Pressable style={styles.unlockButton} onPress={promptUnlock}>
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
    backgroundColor: chrome,
  },
  headerTitle: {
    color: chromeText,
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
  topTabBar: {
    backgroundColor: chrome,
    borderBottomWidth: 1,
    borderBottomColor: cardBorder,
    elevation: 0,
    shadowOpacity: 0,
  },
  topTabItem: {
    width: 'auto',
    paddingHorizontal: 2,
  },
  topTabIndicator: {
    height: 2,
    backgroundColor: primary,
    borderRadius: 999,
  },
  topTabLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'none',
    letterSpacing: 0.2,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
    zIndex: 50,
  },
  lockTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  lockSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
  },
  unlockButton: {
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  unlockLabel: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '700',
  },
});
