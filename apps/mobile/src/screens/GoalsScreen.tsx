import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { colors } from '../theme';

export function GoalsScreen() {
  return (
    <Screen edgeToEdge>
      <View style={styles.content}>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>Beta</Text>
        </View>

        <Text style={styles.title}>Goals Coming Soon</Text>
        <Text style={styles.subtitle}>
          We are rebuilding this experience before opening it to beta users.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What is in progress</Text>
          <Text style={styles.item}>Emergency fund planner with timeline guidance</Text>
          <Text style={styles.item}>Debt payoff plans with monthly recommendations</Text>
          <Text style={styles.item}>Savings milestones tied to real account activity</Text>
          <Text style={styles.item}>Coach-grade guidance from Penny using your live data</Text>
        </View>

        <Text style={styles.footer}>
          Until this launches, ask Penny in chat for coaching on savings, debt payoff, and monthly action plans.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 76,
    paddingBottom: 28,
    gap: 14,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 560,
  },
  card: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    gap: 8,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  item: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});
