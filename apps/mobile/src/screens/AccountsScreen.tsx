import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { colors } from '../theme';

export function AccountsScreen() {
  return (
    <Screen title="Accounts" subtitle="Manage your connections">
      <View style={styles.card}>
        <Text style={styles.label}>Connected accounts</Text>
        <Text style={styles.value}>No accounts linked yet.</Text>
      </View>
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
});
