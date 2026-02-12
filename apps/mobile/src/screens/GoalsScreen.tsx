import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { apiRequest } from '../lib/api';
import { colors } from '../theme';

type Goal = {
  id: string;
  name: string;
  type: string;
  cadence: string;
  current: number;
  target: number;
  status: string;
};

type GoalsResponse = {
  goals: Goal[];
};

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

export function GoalsScreen() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const data = await apiRequest<GoalsResponse>('/api/goals');
        if (isMounted) {
          setGoals(data.goals ?? []);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          const message =
            typeof err === 'object' && err && 'error' in err
              ? String((err as { error?: string }).error)
              : 'Unable to load goals.';
          setError(message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const activeGoals = useMemo(
    () => goals.filter((goal) => goal.status !== 'COMPLETED'),
    [goals]
  );

  return (
    <Screen title="Goals" subtitle="Plan your milestones">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading goals...</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {activeGoals.length === 0 && !loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No active goals</Text>
            <Text style={styles.emptyBody}>Create a goal on the web app to start tracking.</Text>
          </View>
        ) : null}

        {activeGoals.map((goal) => {
          const progress = goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0;
          return (
            <View key={goal.id} style={styles.card}>
              <View style={styles.header}>
                <View>
                  <Text style={styles.title}>{goal.name}</Text>
                  <Text style={styles.meta}>{goal.type} · {goal.cadence}</Text>
                </View>
                <Text style={styles.value}>
                  {formatCurrency(goal.current)} / {formatCurrency(goal.target)}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressText}>{Math.round(progress)}% complete</Text>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 24,
    gap: 14,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(18, 24, 46, 0.7)',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
  },
  emptyCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(18, 24, 46, 0.7)',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  card: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 20, 40, 0.6)',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  value: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  progressTrack: {
    marginTop: 12,
    height: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
  },
  progressText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
});
