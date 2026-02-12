import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';

import ModalSheet from '../components/ModalSheet';
import { Screen } from '../components/Screen';
import { apiRequest } from '../lib/api';
import { colors } from '../theme';

type OverviewResponse = {
  assetsTotal?: number;
  debtTotal?: number;
  monthDailySpend?: number[];
  monthDailyIncome?: number[];
  monthSpendTotal?: number;
  monthBudgetTotal?: number;
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
  recentTransactions?: Array<{
    id: string;
    name: string;
    category: string;
    amount: number;
    isIncome: boolean;
    date: string;
  }>;
  budgetSnapshot?: {
    essentialsSpend: number;
    essentialsBudget: number;
    flexibleSpend: number;
    flexibleBudget: number;
    totalBudget: number;
    totalSpend: number;
    overBudgetCategories: number;
  };
  budgetRecommendations?: string[];
  categoryBudgets?: Array<{
    name: string;
    essential: boolean;
    budget: number;
    spend: number;
    projected: number;
    remaining: number;
    status: 'ok' | 'risk' | 'over';
  }>;
  debtProjection?: {
    remaining: number;
    basePayment: number;
    monthsRemaining: number;
  };
  connectionStatus?: {
    state: 'connected' | 'attention' | 'disconnected';
    title: string;
    description: string;
  };
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
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: 'Ask me about your spending and I’ll surface insights.' },
  ]);
  const [selectedBudgetName, setSelectedBudgetName] = useState('');
  const [sliderValue, setSliderValue] = useState(0);

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

  const flexibleBudgets = useMemo(
    () =>
      (overview?.categoryBudgets ?? []).filter(
        (item) => !item.essential && (item.budget > 0 || item.spend > 0)
      ),
    [overview]
  );

  useEffect(() => {
    if (!flexibleBudgets.length) return;
    if (!selectedBudgetName) {
      const first = flexibleBudgets[0];
      setSelectedBudgetName(first.name);
      setSliderValue(first.budget || first.spend || 0);
      return;
    }
    const match = flexibleBudgets.find((item) => item.name === selectedBudgetName);
    if (!match) {
      const first = flexibleBudgets[0];
      setSelectedBudgetName(first.name);
      setSliderValue(first.budget || first.spend || 0);
    }
  }, [flexibleBudgets, selectedBudgetName]);

  const selectedBudget = flexibleBudgets.find((item) => item.name === selectedBudgetName);
  const sliderMax = selectedBudget
    ? Math.max(selectedBudget.spend, selectedBudget.budget || 0, 100) * 1.5
    : 0;
  const sliderMin = 0;
  const baselineSpend = selectedBudget?.spend ?? 0;
  const changeAmount = baselineSpend - sliderValue;
  const basePayment = overview?.debtProjection?.basePayment ?? 0;
  const debtRemaining = overview?.debtProjection?.remaining ?? 0;
  const monthsNow = overview?.debtProjection?.monthsRemaining ?? 0;
  const newPayment = basePayment + changeAmount;
  const monthsWith =
    debtRemaining > 0 && newPayment > 0 ? Math.ceil(debtRemaining / newPayment) : 0;
  const monthsDelta = monthsNow && monthsWith ? monthsNow - monthsWith : 0;

  const sendMessage = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;
    const nextMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...messages,
      { role: 'user', content: trimmed },
    ];
    setMessages(nextMessages);
    setChatInput('');
    setChatLoading(true);
    try {
      const response = await apiRequest<{ answer?: string }>('/api/insights/chat', {
        method: 'POST',
        body: {
          messages: nextMessages.slice(-6),
        },
      });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.answer ?? 'No insights available yet.' },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'I couldn’t fetch insights right now.' },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

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

        {overview?.connectionStatus && overview.connectionStatus.state !== 'connected' ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{overview.connectionStatus.title}</Text>
            <Text style={styles.sectionSubtitle}>{overview.connectionStatus.description}</Text>
          </View>
        ) : null}

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
            <Text style={styles.sectionTitle}>Transactions snapshot</Text>
            <Text style={styles.sectionSubtitle}>Recent activity</Text>
          </View>
          {(overview?.recentTransactions ?? []).length === 0 ? (
            <Text style={styles.emptyText}>No recent transactions yet.</Text>
          ) : (
            overview?.recentTransactions?.map((tx) => (
              <View key={tx.id} style={styles.snapshotRow}>
                <View>
                  <Text style={styles.snapshotName}>{tx.name}</Text>
                  <Text style={styles.snapshotMeta}>{tx.category} · {tx.date}</Text>
                </View>
                <Text style={[styles.snapshotAmount, tx.isIncome ? styles.positive : styles.negative]}>
                  {tx.isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Income forecast</Text>
            <Text style={styles.sectionSubtitle}>Month-to-date income</Text>
          </View>
          <View style={styles.forecastRow}>
            <Text style={styles.forecastValue}>{formatCurrency(overview?.incomeSummary?.actual ?? 0)}</Text>
            <Text style={styles.forecastMeta}>
              of {formatCurrency(overview?.incomeSummary?.expected ?? 0)} expected
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, Math.round((overview?.incomeSummary?.progress ?? 0) * 100))}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.forecastMeta}>
            {(overview?.incomeSummary?.expected ?? 0) > 0
              ? `${(overview?.incomeSummary?.variance ?? 0) >= 0 ? '+' : '-'}${formatCurrency(
                  Math.abs(overview?.incomeSummary?.variance ?? 0)
                )} vs expected`
              : 'No forecast yet'}
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Assets & debt</Text>
            <Text style={styles.sectionSubtitle}>Across linked accounts</Text>
          </View>
          <View style={styles.assetRow}>
            <View style={styles.assetCard}>
              <Text style={styles.assetLabel}>Assets</Text>
              <Text style={styles.assetValue}>{formatCurrency(overview?.assetsTotal ?? 0)}</Text>
            </View>
            <View style={styles.assetCard}>
              <Text style={styles.assetLabel}>Debt</Text>
              <Text style={styles.assetValue}>{formatCurrency(overview?.debtTotal ?? 0)}</Text>
            </View>
          </View>
        </View>

        {overview?.budgetSnapshot ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Budget snapshot</Text>
              <Text style={styles.sectionSubtitle}>Essentials vs flexible</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Essentials</Text>
              <Text style={styles.detailValue}>
                {formatCurrency(overview.budgetSnapshot.essentialsSpend)} / {formatCurrency(overview.budgetSnapshot.essentialsBudget)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Flexible</Text>
              <Text style={styles.detailValue}>
                {formatCurrency(overview.budgetSnapshot.flexibleSpend)} / {formatCurrency(overview.budgetSnapshot.flexibleBudget)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total</Text>
              <Text style={styles.detailValue}>
                {formatCurrency(overview.budgetSnapshot.totalSpend)} / {formatCurrency(overview.budgetSnapshot.totalBudget)}
              </Text>
            </View>
          </View>
        ) : null}

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

        {overview?.budgetRecommendations && overview.budgetRecommendations.length > 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Budget recommendations</Text>
            {overview.budgetRecommendations.map((item) => (
              <Text key={item} style={styles.recommendationText}>{item}</Text>
            ))}
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Budget tuning</Text>
            <Text style={styles.sectionSubtitle}>
              Adjust a flexible category and see payoff timing change.
            </Text>
          </View>
          {flexibleBudgets.length > 0 ? (
            <View style={styles.tuningCard}>
              <View style={styles.filterRow}>
                {flexibleBudgets.slice(0, 4).map((item) => (
                  <Pressable
                    key={item.name}
                    style={[
                      styles.tuningChip,
                      selectedBudgetName === item.name && styles.tuningChipActive,
                    ]}
                    onPress={() => {
                      setSelectedBudgetName(item.name);
                      setSliderValue(item.budget || item.spend || 0);
                    }}
                  >
                    <Text
                      style={[
                        styles.tuningChipLabel,
                        selectedBudgetName === item.name && styles.tuningChipLabelActive,
                      ]}
                    >
                      {item.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.tuningScaleRow}>
                <Text style={styles.tuningScaleLabel}>{formatCurrency(sliderMin)}</Text>
                <Text style={styles.tuningScaleValue}>{formatCurrency(sliderValue)}</Text>
                <Text style={styles.tuningScaleLabel}>{formatCurrency(Math.round(sliderMax))}</Text>
              </View>
              <Slider
                minimumValue={sliderMin}
                maximumValue={sliderMax || 1}
                value={sliderValue}
                onValueChange={setSliderValue}
                step={10}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.cardBorder}
                thumbTintColor={colors.primary}
              />
              <Text style={styles.tuningSummary}>
                {debtRemaining <= 0
                  ? 'Add a debt payoff goal to see projections.'
                  : newPayment <= 0
                  ? 'Lowering this too much removes your debt payoff signal.'
                  : monthsDelta > 0
                  ? `With ${formatCurrency(Math.abs(changeAmount))} freed up monthly, you finish about ${monthsDelta} months sooner.`
                  : monthsDelta < 0
                  ? `With ${formatCurrency(Math.abs(changeAmount))} added monthly spend, payoff moves about ${Math.abs(monthsDelta)} months later.`
                  : 'This setting keeps your debt payoff pace unchanged.'}
              </Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>Add flexible budgets to enable payoff tuning.</Text>
          )}
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
          <Pressable style={styles.chatButton} onPress={() => setChatOpen(true)}>
            <Text style={styles.chatButtonLabel}>Open chat coach</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ModalSheet visible={chatOpen} onClose={() => setChatOpen(false)}>
        <Text style={styles.modalTitle}>AI spending insights</Text>
        <View style={styles.chatList}>
          {messages.map((message, index) => (
            <View
              key={`${message.role}-${index}`}
              style={[
                styles.chatBubble,
                message.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAssistant,
              ]}
            >
              <Text
                style={[
                  styles.chatText,
                  message.role === 'user' ? styles.chatTextUser : styles.chatTextAssistant,
                ]}
              >
                {message.content}
              </Text>
            </View>
          ))}
          {chatLoading ? <Text style={styles.chatLoading}>Thinking…</Text> : null}
        </View>
        <View style={styles.chatInputRow}>
          <TextInput
            value={chatInput}
            onChangeText={setChatInput}
            placeholder="Ask about your spending..."
            placeholderTextColor={colors.textMuted}
            style={styles.chatInput}
          />
          <Pressable style={styles.chatSend} onPress={sendMessage} disabled={chatLoading}>
            <Text style={styles.chatSendLabel}>{chatLoading ? '...' : 'Send'}</Text>
          </Pressable>
        </View>
      </ModalSheet>
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
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  snapshotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  snapshotName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  snapshotMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  snapshotAmount: {
    fontSize: 12,
    fontWeight: '700',
  },
  forecastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  forecastValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  forecastMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  assetRow: {
    flexDirection: 'row',
    gap: 12,
  },
  assetCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 12,
  },
  assetLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  assetValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  detailValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
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
  chatButton: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chatButtonLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
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
  recommendationText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  tuningCard: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tuningChip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tuningChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tuningChipLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  tuningChipLabelActive: {
    color: colors.background,
  },
  tuningScaleRow: {
    marginTop: 10,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tuningScaleLabel: {
    color: colors.textMuted,
    fontSize: 11,
  },
  tuningScaleValue: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  tuningSummary: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  chatList: {
    gap: 8,
    maxHeight: 320,
    marginBottom: 12,
  },
  chatBubble: {
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    maxWidth: '85%',
  },
  chatBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
  },
  chatBubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  chatText: {
    fontSize: 12,
  },
  chatTextUser: {
    color: colors.background,
  },
  chatTextAssistant: {
    color: colors.text,
  },
  chatLoading: {
    color: colors.textMuted,
    fontSize: 12,
  },
  chatInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
    backgroundColor: 'rgba(9, 13, 27, 0.7)',
  },
  chatSend: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chatSendLabel: {
    color: colors.background,
    fontWeight: '700',
  },
});
