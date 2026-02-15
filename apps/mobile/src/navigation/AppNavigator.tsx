import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';

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
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: 'rgba(12, 17, 36, 0.92)',
          borderTopColor: colors.cardBorder,
          height: 64,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color, size }) => {
          const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
            Dashboard: 'grid',
            Distribution: 'analytics',
            Transactions: 'swap-vertical',
            Goals: 'flag',
            Accounts: 'wallet',
            Categories: 'layers',
            Settings: 'settings',
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
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <View style={styles.container}>
        <MainTabs />
        <CoachChatFab />
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
