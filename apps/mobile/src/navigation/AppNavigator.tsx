import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CoachChatFab } from '../components/CoachChatFab';
import { AccountsScreen } from '../screens/AccountsScreen';
import { CategoriesScreen } from '../screens/CategoriesScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { DistributionScreen } from '../screens/DistributionScreen';
import { GoalsScreen } from '../screens/GoalsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { colors, navigationTheme } from '../theme';

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
              color={colors.text}
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
  return (
    <NavigationContainer theme={navigationTheme}>
      <View style={styles.container}>
        <MainTabs />
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
    color: colors.text,
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
    borderColor: colors.cardBorder,
    backgroundColor: colors.elevated,
  },
  headerSideContainer: {
    paddingHorizontal: 12,
  },
});
