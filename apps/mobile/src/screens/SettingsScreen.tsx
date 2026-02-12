import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

export function SettingsScreen() {
  const { user, signOut } = useAuth();

  return (
    <Screen title="Settings" subtitle="Manage your account">
      <View style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value}>{user?.email ?? 'Unknown'}</Text>
      </View>
      <Pressable style={styles.button} onPress={signOut}>
        <Text style={styles.buttonLabel}>Sign Out</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 20,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    color: colors.text,
    marginTop: 8,
    fontSize: 15,
  },
  button: {
    backgroundColor: colors.danger,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonLabel: {
    color: colors.background,
    fontWeight: '700',
  },
});
