import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { apiRequest } from '../lib/api';
import { colors } from '../theme';

type OverviewResponse = {
  assetsTotal?: number;
  debtTotal?: number;
  monthDailySpend?: number[];
  monthSpendTotal?: number;
  monthDaysElapsed?: number;
  incomeSummary?: {
    actual: number;
    expected: number;
    remaining: number;
    variance: number;
    progress: number;
  };
  categoryMonthSummary?: Array<{
    name: string;
    spend: number;
    budget: number | null;
  }>;
  categorySummaryLabel?: string;
  goals?: Array<{
    id?: string;
    name: string;
    current: number;
    target: number;
  }>;
  snapshot?: {
    aiHighlights?: string[];
    aiActions?: string[];
  };
};

type SummaryMetric = {
  label: string;
  value: string;
  delta: string;
  tone: 'positive' | 'negative' | 'neutral';
};

type CategoryMetric = {
  name: string;
  amount: string;
  percent: number;
};

type GoalMetric = {
  name: string;
  progress: number;
  amount: string;
  target: string;
};

const fallbackSummary: SummaryMetric[] = [
  { label: 'Spend', value: '$3,482', delta: '-6% vs Jan', tone: 'positive' },
  { label: 'Income', value: '$7,940', delta: '+12% vs Jan', tone: 'positive' },
  { label: 'Assets', value: '$128k', delta: '+2.1% MTD', tone: 'positive' },
  { label: 'Debt', value: '$24.6k', delta: '-$620 paid', tone: 'positive' },
];

const fallbackMonthlySpend = [
  { month: 'Sep', value: 3120 },
  { month: 'Oct', value: 3580 },
  { month: 'Nov', value: 4010 },
  { month: 'Dec', value: 4380 },
  { month: 'Jan', value: 3725 },
  { month: 'Feb', value: 3482 },
];

const fallbackCategories: CategoryMetric[] = [
  { name: 'Groceries', amount: '$612', percent: 72 },
  { name: 'Dining', amount: '$428', percent: 54 },
  { name: 'Travel', amount: '$382', percent: 46 },
  { name: 'Subscriptions', amount: '$214', percent: 28 },
];

const fallbackGoals: GoalMetric[] = [
  { name: 'Emergency Fund', progress: 68, amount: '$8,150', target: '$12,000' },
  { name: 'Car Payoff', progress: 42, amount: '$5,040', target: '$12,000' },
  { name: 'Home Down Payment', progress: 24, amount: '$9,600', target: '$40,000' },
];

const formatCurrency = (value: number, compact = false) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
  });

const formatDelta = (value: number) => {
  if (value === 0) return '0% vs expected';
  const sign = value > 0 ? '+' : '-';
  const pct = Math.abs(value).toFixed(0);
  return `${sign}${pct}% vs expected`;
};

const buildMonthlySpend = (dailySpend: number[] | undefined) => {
  if (!dailySpend || dailySpend.length === 0) {
    return fallbackMonthlySpend;
  }
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const month = now.getMonth();
  const total = dailySpend.reduce((acc, value) => acc + value, 0);
  const points = [5, 4, 3, 2, 1, 0].map((offset) => {
    const idx = (month - offset + 12) % 12;
    const scale = offset === 0 ? 1 : Math.max(0.65, 1 - offset * 0.08);
    return {
      month: monthNames[idx],
      value: Math.round(total * scale),
    };
  });
  return points;
};

export function DashboardScreen() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const data = await apiRequest<OverviewResponse>('/api/client/overview');
        if (isMounted) {
          setOverview(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          const message =
            typeof err === 'object' && err && 'error' in err
              ? String((err as { error?: string }).error)
              : 'Unable to load dashboard.';
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

  const summaryMetrics = useMemo(() => {
    if (!overview) return fallbackSummary;
    const spend = overview.monthSpendTotal ?? 0;
    const income = overview.incomeSummary?.expected ?? overview.incomeSummary?.actual ?? 0;
    const incomeVariance = overview.incomeSummary?.variance ?? 0;
    const variancePct = income > 0 ? (incomeVariance / income) * 100 : 0;
    const assets = overview.assetsTotal ?? 0;
    const debt = overview.debtTotal ?? 0;

    return [
      {
        label: 'Spend',
        value: formatCurrency(spend, true),
        delta: `${overview.monthDaysElapsed ?? 0} days tracked`,
        tone: 'neutral',
      },
      {
        label: 'Income',
        value: formatCurrency(income, true),
        delta: formatDelta(variancePct),
        tone: variancePct >= 0 ? 'positive' : 'negative',
      },
      {
        label: 'Assets',
        value: formatCurrency(assets, true),
        delta: assets > 0 ? 'Net worth to date' : 'Connect accounts',
        tone: assets > 0 ? 'positive' : 'neutral',
      },
      {
        label: 'Debt',
        value: formatCurrency(debt, true),
        delta: debt > 0 ? 'Total outstanding' : 'No debt tracked',
        tone: debt > 0 ? 'neutral' : 'positive',
      },
    ] as SummaryMetric[];
  }, [overview]);

  const monthlySpend = useMemo(() => buildMonthlySpend(overview?.monthDailySpend), [overview]);

  const topCategories = useMemo(() => {
    if (!overview?.categoryMonthSummary?.length) {
      return fallbackCategories;
    }
    const max = Math.max(...overview.categoryMonthSummary.map((item) => item.spend), 1);
    return overview.categoryMonthSummary.slice(0, 4).map((item) => ({
      name: item.name,
      amount: formatCurrency(item.spend),
      percent: Math.round((item.spend / max) * 100),
    }));
  }, [overview]);

  const goals = useMemo(() => {
    if (!overview?.goals?.length) {
      return fallbackGoals;
    }
    return overview.goals.slice(0, 3).map((goal) => {
      const progress = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
      return {
        name: goal.name,
        progress,
        amount: formatCurrency(goal.current),
        target: formatCurrency(goal.target),
      };
    });
  }, [overview]);

  const aiSummary = useMemo(() => {
    if (!overview?.snapshot?.aiHighlights?.length) {
      return {
        highlight: 'Spend trends will show once accounts sync.',
        action: 'Connect a bank to unlock AI summaries.',
      };
    }
    return {
      highlight: overview.snapshot.aiHighlights[0],
      action: overview.snapshot.aiActions?.[0] ?? 'Review your latest insights.',
    };
  }, [overview]);

  return (
    <Screen title="Dashboard" subtitle="February snapshot and key wins.">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Syncing dashboard...</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <View style={styles.summaryGrid}>
          {summaryMetrics.map((metric) => (
            <View key={metric.label} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{metric.label}</Text>
              <Text style={styles.summaryValue}>{metric.value}</Text>
              <Text
                style={[
                  styles.summaryDelta,
                  metric.tone === 'positive'
                    ? styles.positive
                    : metric.tone === 'negative'
                      ? styles.negative
                      : styles.neutral,
                ]}
              >
                {metric.delta}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Monthly spend</Text>
            <Text style={styles.sectionSubtitle}>6-month trend</Text>
          </View>
          <View style={styles.chart}>
            {monthlySpend.map((item) => {
              const maxSpend = Math.max(...monthlySpend.map((entry) => entry.value), 1);
              const height = Math.round((item.value / maxSpend) * 110) + 10;
              return (
                <View key={item.month} style={styles.chartItem}>
                  <View style={[styles.chartBar, { height }]} />
                  <Text style={styles.chartLabel}>{item.month}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.chartFooter}>
            <Text style={styles.chartValue}>
              {formatCurrency(overview?.monthSpendTotal ?? 3482)}
            </Text>
            <Text style={styles.chartHint}>{overview?.categorySummaryLabel ?? 'Projected to finish 8% under budget.'}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top categories</Text>
            <Text style={styles.sectionSubtitle}>Most active this month</Text>
          </View>
          {topCategories.map((category) => (
            <View key={category.name} style={styles.categoryRow}>
              <View style={styles.categoryMeta}>
                <Text style={styles.categoryName}>{category.name}</Text>
                <Text style={styles.categoryAmount}>{category.amount}</Text>
              </View>
              <View style={styles.categoryBarTrack}>
                <View style={[styles.categoryBarFill, { width: `${category.percent}%` }]} />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Goals progress</Text>
            <Text style={styles.sectionSubtitle}>Keep the momentum going</Text>
          </View>
          {goals.map((goal) => (
            <View key={goal.name} style={styles.goalRow}>
              <View style={styles.goalHeader}>
                <Text style={styles.goalName}>{goal.name}</Text>
                <Text style={styles.goalAmount}>{goal.amount} / {goal.target}</Text>
              </View>
              <View style={styles.goalBarTrack}>
                <View style={[styles.goalBarFill, { width: `${goal.progress}%` }]} />
              </View>
              <Text style={styles.goalProgress}>{goal.progress}% complete</Text>
            </View>
          ))}
        </View>

        <View style={[styles.sectionCard, styles.aiCard]}>
          <Text style={styles.aiTitle}>AI coach summary</Text>
          <Text style={styles.aiBody}>{aiSummary.highlight}</Text>
          <View style={styles.aiFooter}>
            <Text style={styles.aiTag}>Next step</Text>
            <Text style={styles.aiAction}>{aiSummary.action}</Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 28,
    gap: 18,
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
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    width: '48%',
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(18, 24, 46, 0.7)',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  summaryDelta: {
    fontSize: 12,
    marginTop: 6,
  },
  positive: {
    color: colors.success,
  },
  negative: {
    color: colors.danger,
  },
  neutral: {
    color: colors.textMuted,
  },
  sectionCard: {
    backgroundColor: 'rgba(17, 22, 43, 0.7)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
    marginBottom: 12,
  },
  chartItem: {
    alignItems: 'center',
    flex: 1,
  },
  chartBar: {
    width: 18,
    borderRadius: 10,
    backgroundColor: colors.primary,
    marginBottom: 8,
  },
  chartLabel: {
    color: colors.textMuted,
    fontSize: 11,
  },
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  chartValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  chartHint: {
    color: colors.textMuted,
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
  categoryRow: {
    marginBottom: 12,
  },
  categoryMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  categoryName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryAmount: {
    color: colors.textMuted,
    fontSize: 13,
  },
  categoryBarTrack: {
    marginTop: 6,
    height: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 6,
  },
  goalRow: {
    marginBottom: 16,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  goalName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  goalAmount: {
    color: colors.textMuted,
    fontSize: 12,
  },
  goalBarTrack: {
    marginTop: 8,
    height: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  goalBarFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 8,
  },
  goalProgress: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  aiCard: {
    backgroundColor: 'rgba(20, 28, 54, 0.85)',
  },
  aiTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  aiBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  aiFooter: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  aiTag: {
    color: colors.accent,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  aiAction: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
});
