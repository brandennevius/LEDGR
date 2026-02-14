import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import Chip from '../components/Chip';
import ModalSheet from '../components/ModalSheet';
import { Screen } from '../components/Screen';
import { apiRequest } from '../lib/api';
import { colors } from '../theme';

type OverviewResponse = {
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
  categoryBudgets?: Array<{
    name: string;
    essential: boolean;
    budget: number;
    spend: number;
    projected: number;
    remaining: number;
    status: 'ok' | 'risk' | 'over';
  }>;
};

type TransactionRow = {
  id: string;
  baseId?: string;
  name: string;
  category: string;
  amount: number;
  isIncome: boolean;
  needsReview?: boolean;
  date: string;
};

type TransactionsResponse = {
  transactions: TransactionRow[];
};

type TransactionDetail = {
  id: string;
  name: string;
  amount: number;
  category: string;
  transactionType?: 'INCOME' | 'INTERNAL_TRANSFER' | 'REGULAR';
  date: string;
  needsReview?: boolean;
  account?: {
    name?: string;
    institutionName?: string;
    mask?: string;
    type?: string;
  };
};

type ChartSeries = {
  spend: number[];
  income: number[];
  expectedIncome: number[];
  budget: number[];
  daysInMonth: number;
  daysElapsed: number;
};

const formatCurrency = (value: number, fractionDigits = 0) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  });

const buildSeries = (overview: OverviewResponse | null): ChartSeries => {
  const spend = overview?.monthDailySpend ?? [];
  const income = overview?.monthDailyIncome ?? [];
  const daysInMonth = Math.max(spend.length, income.length, 28);
  const daysElapsed = Math.max(1, Math.min(overview?.monthDaysElapsed ?? spend.length, daysInMonth));
  const expectedIncomeTotal = Math.max(overview?.incomeSummary?.expected ?? 0, 0);
  const budgetTotal = Math.max(overview?.monthBudgetTotal ?? 0, 0);

  const expectedIncome = Array.from({ length: daysInMonth }, (_, index) =>
    (expectedIncomeTotal / daysInMonth) * (index + 1)
  );
  const budget = Array.from({ length: daysInMonth }, (_, index) =>
    (budgetTotal / daysInMonth) * (index + 1)
  );

  return {
    spend: spend.slice(0, daysElapsed),
    income: income.slice(0, daysElapsed),
    expectedIncome,
    budget,
    daysInMonth,
    daysElapsed,
  };
};

const toPolylinePoints = (values: number[], totalPoints: number, width: number, height: number, maxValue: number) => {
  if (values.length === 0 || width <= 0 || height <= 0 || maxValue <= 0) return '';
  if (values.length === 1) {
    const y = height - (values[0] / maxValue) * height;
    return `0,${y.toFixed(2)}`;
  }
  const stepX = width / Math.max(totalPoints - 1, 1);
  return values
    .map((value, index) => {
      const x = index * stepX;
      const y = height - (value / maxValue) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
};

const initials = (label: string) => {
  const trimmed = label.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
};

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [reviewRows, setReviewRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingDetail, setSavingDetail] = useState(false);
  const [selected, setSelected] = useState<TransactionDetail | null>(null);
  const [categoryInput, setCategoryInput] = useState('');
  const [transactionTypeInput, setTransactionTypeInput] = useState<'INCOME' | 'INTERNAL_TRANSFER' | 'REGULAR'>('REGULAR');
  const [applyToSimilar, setApplyToSimilar] = useState(false);
  const [applyToCategory, setApplyToCategory] = useState(false);
  const [createRule, setCreateRule] = useState(false);
  const [ruleMatchType, setRuleMatchType] = useState<'EXACT' | 'PARTIAL'>('EXACT');
  const [ruleMatchValue, setRuleMatchValue] = useState('');

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const [overviewData, reviewData] = await Promise.all([
        apiRequest<OverviewResponse>('/api/client/overview'),
        apiRequest<TransactionsResponse>('/api/transactions?days=60&needsReview=true'),
      ]);
      setOverview(overviewData);
      setReviewRows(reviewData.transactions ?? []);
      setError(null);
    } catch (err) {
      const message =
        typeof err === 'object' && err && 'error' in err
          ? String((err as { error?: string }).error)
          : 'Unable to load dashboard.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const chartSeries = useMemo(() => buildSeries(overview), [overview]);
  const chartHeight = 172;
  const maxChartValue = useMemo(() => {
    const spendPeak = Math.max(...chartSeries.spend, 0);
    const incomePeak = Math.max(...chartSeries.income, 0);
    const expectedPeak = Math.max(...chartSeries.expectedIncome, 0);
    const budgetPeak = Math.max(...chartSeries.budget, 0);
    return Math.max(spendPeak, incomePeak, expectedPeak, budgetPeak, 1);
  }, [chartSeries]);

  const spendPoints = useMemo(
    () =>
      toPolylinePoints(
        chartSeries.spend,
        chartSeries.daysInMonth,
        chartWidth,
        chartHeight,
        maxChartValue
      ),
    [chartSeries, chartHeight, chartWidth, maxChartValue]
  );
  const incomePoints = useMemo(
    () =>
      toPolylinePoints(
        chartSeries.income,
        chartSeries.daysInMonth,
        chartWidth,
        chartHeight,
        maxChartValue
      ),
    [chartSeries, chartHeight, chartWidth, maxChartValue]
  );
  const expectedIncomePoints = useMemo(
    () =>
      toPolylinePoints(
        chartSeries.expectedIncome,
        chartSeries.daysInMonth,
        chartWidth,
        chartHeight,
        maxChartValue
      ),
    [chartSeries, chartHeight, chartWidth, maxChartValue]
  );
  const budgetPoints = useMemo(
    () =>
      toPolylinePoints(
        chartSeries.budget,
        chartSeries.daysInMonth,
        chartWidth,
        chartHeight,
        maxChartValue
      ),
    [chartSeries, chartHeight, chartWidth, maxChartValue]
  );

  const groupedReviewRows = useMemo(() => {
    const deduped: TransactionRow[] = [];
    const seen = new Set<string>();
    reviewRows.forEach((row) => {
      const key = row.baseId ?? row.id;
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push({ ...row, id: key });
    });

    const map = new Map<string, TransactionRow[]>();
    deduped.forEach((row) => {
      const key = row.date;
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    });

    return Array.from(map.entries()).map(([day, items]) => ({
      day,
      items,
    }));
  }, [reviewRows]);

  const budgetItems = useMemo(
    () =>
      (overview?.categoryBudgets ?? [])
        .filter((item) => item.budget > 0)
        .sort((a, b) => {
          const aOver = a.spend - a.budget;
          const bOver = b.spend - b.budget;
          if (aOver > 0 && bOver <= 0) return -1;
          if (bOver > 0 && aOver <= 0) return 1;
          return b.spend - a.spend;
        })
        .slice(0, 8),
    [overview]
  );

  const openDetail = async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const detail = await apiRequest<TransactionDetail>(`/api/transactions/${id}`);
      setSelected(detail);
      setCategoryInput(detail.category ?? '');
      setTransactionTypeInput(detail.transactionType ?? 'REGULAR');
      setApplyToSimilar(false);
      setApplyToCategory(false);
      setCreateRule(false);
      setRuleMatchType('EXACT');
      setRuleMatchValue('');
    } finally {
      setDetailLoading(false);
    }
  };

  const saveDetail = async () => {
    if (!selected) return;
    setSavingDetail(true);
    try {
      await apiRequest(`/api/transactions/${selected.id}`, {
        method: 'PATCH',
        body: {
          category: categoryInput,
          transactionType: transactionTypeInput,
          applyToSimilar,
          applyToCategory,
          createRule,
          ruleMatchType,
          ruleMatchValue,
        },
      });
      setDetailOpen(false);
      await loadDashboard();
    } finally {
      setSavingDetail(false);
    }
  };

  const markReviewed = async (id: string, category?: string) => {
    await apiRequest('/api/transactions/review', {
      method: 'POST',
      body: { id, category },
    });
    await loadDashboard();
  };

  const markGroupReviewed = async (items: TransactionRow[]) => {
    await Promise.all(
      items.map((item) =>
        apiRequest('/api/transactions/review', {
          method: 'POST',
          body: { id: item.id, category: item.category },
        })
      )
    );
    await loadDashboard();
  };

  const onChartLayout = (event: LayoutChangeEvent) => {
    const width = Math.max(0, event.nativeEvent.layout.width - 8);
    if (width !== chartWidth) setChartWidth(width);
  };

  const spent = overview?.monthSpendTotal ?? 0;
  const budget = overview?.monthBudgetTotal ?? 0;
  const budgetDiff = budget - spent;

  return (
    <Screen title="Dashboard" subtitle="Live overview from linked accounts.">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Syncing dashboard...</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Monthly spend</Text>
              <Text style={styles.sectionSubtitle}>Expected income vs spend and budget pace</Text>
            </View>
            <Pressable onPress={() => navigation.navigate('Transactions')}>
              <Text style={styles.linkText}>Transactions</Text>
            </Pressable>
          </View>
          <Text style={styles.heroValue}>{formatCurrency(spent)}</Text>
          <Text style={styles.heroMeta}>
            {budget > 0
              ? budgetDiff >= 0
                ? `${formatCurrency(budgetDiff)} left of ${formatCurrency(budget)} budget`
                : `${formatCurrency(Math.abs(budgetDiff))} over ${formatCurrency(budget)} budget`
              : 'No monthly budget set yet'}
          </Text>
          <View style={styles.chartFrame} onLayout={onChartLayout}>
            {chartWidth > 20 ? (
              <Svg width={chartWidth} height={chartHeight + 18}>
                {[0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = chartHeight - ratio * chartHeight;
                  return (
                    <Line
                      key={`grid-${ratio}`}
                      x1={0}
                      y1={y}
                      x2={chartWidth}
                      y2={y}
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth={1}
                    />
                  );
                })}

                {budget > 0 ? (
                  <Polyline
                    points={budgetPoints}
                    fill="none"
                    stroke="rgba(99, 102, 241, 0.95)"
                    strokeWidth={2}
                    strokeDasharray="4,5"
                  />
                ) : null}

                {(overview?.incomeSummary?.expected ?? 0) > 0 ? (
                  <Polyline
                    points={expectedIncomePoints}
                    fill="none"
                    stroke="rgba(56, 189, 248, 0.95)"
                    strokeWidth={2}
                    strokeDasharray="8,6"
                  />
                ) : null}

                {incomePoints ? (
                  <Polyline
                    points={incomePoints}
                    fill="none"
                    stroke={colors.success}
                    strokeWidth={3}
                  />
                ) : null}
                {spendPoints ? (
                  <Polyline
                    points={spendPoints}
                    fill="none"
                    stroke="#fb7185"
                    strokeWidth={3}
                  />
                ) : null}
              </Svg>
            ) : null}
          </View>
          <View style={styles.legendRow}>
            <Text style={styles.legendText}>
              <Text style={styles.legendSpend}>●</Text> Spend
            </Text>
            <Text style={styles.legendText}>
              <Text style={styles.legendIncome}>●</Text> Income
            </Text>
            <Text style={styles.legendText}>
              <Text style={styles.legendExpected}>●</Text> Expected income
            </Text>
            <Text style={styles.legendText}>
              <Text style={styles.legendBudget}>●</Text> Budget pace
            </Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>To review</Text>
            <Pressable onPress={() => navigation.navigate('Transactions')}>
              <Text style={styles.linkText}>View all</Text>
            </Pressable>
          </View>

          {groupedReviewRows.length === 0 ? (
            <Text style={styles.emptyText}>No transactions need review right now.</Text>
          ) : (
            groupedReviewRows.map((group) => (
              <View key={group.day} style={styles.reviewDayCard}>
                <Text style={styles.reviewDay}>{group.day}</Text>
                {group.items.map((item) => (
                  <View key={item.id} style={styles.reviewItemWrap}>
                    <Pressable onPress={() => openDetail(item.id)} style={styles.reviewRow}>
                      <View style={styles.reviewMeta}>
                        <Text style={styles.reviewName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <View style={styles.categoryChip}>
                          <Text style={styles.categoryChipText} numberOfLines={1}>
                            {item.category}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.reviewAmount, item.isIncome ? styles.positive : styles.negative]}>
                        {item.isIncome ? '+' : '-'}
                        {formatCurrency(item.amount, 2)}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.reviewButton}
                      onPress={() => markReviewed(item.id, item.category)}
                    >
                      <Text style={styles.reviewButtonLabel}>Mark as reviewed</Text>
                    </Pressable>
                  </View>
                ))}
                {group.items.length > 1 ? (
                  <Pressable style={styles.groupReviewButton} onPress={() => markGroupReviewed(group.items)}>
                    <Text style={styles.groupReviewLabel}>Mark day as reviewed</Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Budgets</Text>
            <Pressable onPress={() => navigation.navigate('Categories')}>
              <Text style={styles.linkText}>View all</Text>
            </Pressable>
          </View>
          {budgetItems.length === 0 ? (
            <Text style={styles.emptyText}>Set category budgets to track month-to-date pacing.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.budgetScroll}>
              {budgetItems.map((item) => {
                const ratio = item.budget > 0 ? item.spend / item.budget : 0;
                const progress = Math.max(0, Math.min(1, ratio));
                const over = item.spend > item.budget;
                const ringColor = over ? '#ef4444' : '#22c55e';
                const overUnderAmount = Math.abs(item.spend - item.budget);
                const center = 45;
                const radius = 32;
                const circumference = 2 * Math.PI * radius;
                const dashoffset = circumference * (1 - progress);

                return (
                  <View key={item.name} style={styles.budgetCard}>
                    <Svg width={90} height={90}>
                      <Circle
                        cx={center}
                        cy={center}
                        r={radius}
                        stroke="rgba(255,255,255,0.18)"
                        strokeWidth={8}
                        fill="transparent"
                      />
                      <Circle
                        cx={center}
                        cy={center}
                        r={radius}
                        stroke={ringColor}
                        strokeWidth={8}
                        fill="transparent"
                        strokeDasharray={`${circumference} ${circumference}`}
                        strokeDashoffset={dashoffset}
                        strokeLinecap="round"
                        transform={`rotate(-90 ${center} ${center})`}
                      />
                    </Svg>
                    <View style={styles.budgetInitialBadge}>
                      <Text style={styles.budgetInitialText}>{initials(item.name)}</Text>
                    </View>
                    <Text numberOfLines={1} style={styles.budgetName}>
                      {item.name}
                    </Text>
                    <Text style={[styles.budgetDelta, over ? styles.negative : styles.positive]}>
                      {formatCurrency(overUnderAmount)}
                    </Text>
                    <Text style={styles.budgetState}>{over ? 'over' : 'under'}</Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      <ModalSheet visible={detailOpen} onClose={() => setDetailOpen(false)}>
        {detailLoading || !selected ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading details...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.detailContent}>
            <Text style={styles.detailHeader}>Transaction to review</Text>
            <Text style={styles.detailDate}>{new Date(selected.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
            <Text style={styles.detailTitle}>{selected.name}</Text>
            <Text style={styles.detailAmount}>
              {selected.amount < 0 ? '+' : '-'}
              {formatCurrency(Math.abs(selected.amount), 2)}
            </Text>
            <Text style={styles.detailAccount}>
              {selected.account?.institutionName ?? 'Account'} · {selected.account?.name ?? 'Linked account'}
            </Text>

            <Text style={styles.detailSectionTitle}>Category</Text>
            <TextInput
              value={categoryInput}
              onChangeText={setCategoryInput}
              placeholder="Category"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <Text style={styles.detailSectionTitle}>Transaction type</Text>
            <View style={styles.filterRow}>
              {(['REGULAR', 'INCOME', 'INTERNAL_TRANSFER'] as const).map((type) => (
                <Chip
                  key={type}
                  label={type.replace('_', ' ')}
                  active={transactionTypeInput === type}
                  onPress={() => setTransactionTypeInput(type)}
                />
              ))}
            </View>

            <View style={styles.filterRow}>
              <Chip
                label={applyToSimilar ? 'Apply similar ✓' : 'Apply similar'}
                active={applyToSimilar}
                onPress={() => setApplyToSimilar((prev) => !prev)}
              />
              <Chip
                label={applyToCategory ? 'Apply category ✓' : 'Apply category'}
                active={applyToCategory}
                onPress={() => setApplyToCategory((prev) => !prev)}
              />
              <Chip
                label={createRule ? 'Create rule ✓' : 'Create rule'}
                active={createRule}
                onPress={() => setCreateRule((prev) => !prev)}
              />
            </View>

            {createRule ? (
              <View style={styles.ruleWrap}>
                <View style={styles.filterRow}>
                  <Chip
                    label="Exact"
                    active={ruleMatchType === 'EXACT'}
                    onPress={() => setRuleMatchType('EXACT')}
                  />
                  <Chip
                    label="Partial"
                    active={ruleMatchType === 'PARTIAL'}
                    onPress={() => setRuleMatchType('PARTIAL')}
                  />
                </View>
                <TextInput
                  value={ruleMatchValue}
                  onChangeText={setRuleMatchValue}
                  placeholder="Rule match text"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                />
              </View>
            ) : null}

            <View style={styles.detailActionRow}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => markReviewed(selected.id, categoryInput || selected.category)}
              >
                <Text style={styles.secondaryLabel}>Mark reviewed</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={saveDetail} disabled={savingDetail}>
                <Text style={styles.primaryLabel}>{savingDetail ? 'Saving...' : 'Save changes'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </ModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 26,
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
  sectionCard: {
    backgroundColor: 'rgba(17, 22, 43, 0.72)',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  linkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  heroValue: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '800',
    marginTop: 2,
  },
  heroMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  chartFrame: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(5, 10, 24, 0.6)',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  legendRow: {
    marginTop: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  legendSpend: {
    color: '#fb7185',
  },
  legendIncome: {
    color: colors.success,
  },
  legendExpected: {
    color: '#38BDF8',
  },
  legendBudget: {
    color: '#6366f1',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  reviewDayCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(9, 14, 30, 0.56)',
    padding: 12,
    gap: 10,
  },
  reviewDay: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  reviewItemWrap: {
    gap: 8,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  reviewMeta: {
    flex: 1,
    gap: 6,
  },
  reviewName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  categoryChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(110, 120, 255, 0.18)',
    maxWidth: '92%',
  },
  categoryChipText: {
    color: '#d3d8ff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  reviewAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  reviewButton: {
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  reviewButtonLabel: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  groupReviewButton: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.5)',
  },
  groupReviewLabel: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  budgetScroll: {
    gap: 12,
    paddingRight: 8,
  },
  budgetCard: {
    width: 108,
    alignItems: 'center',
    gap: 4,
  },
  budgetInitialBadge: {
    marginTop: -62,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  budgetInitialText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  budgetName: {
    color: colors.textMuted,
    marginTop: 24,
    fontSize: 11,
    width: '100%',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  budgetDelta: {
    fontSize: 16,
    fontWeight: '800',
  },
  budgetState: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'lowercase',
  },
  positive: {
    color: colors.success,
  },
  negative: {
    color: colors.danger,
  },
  detailContent: {
    gap: 10,
    paddingBottom: 20,
  },
  detailHeader: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailDate: {
    color: colors.textMuted,
    fontSize: 14,
  },
  detailTitle: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 40,
  },
  detailAmount: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  detailAccount: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 2,
  },
  detailSectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: 'rgba(9, 13, 27, 0.7)',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ruleWrap: {
    gap: 8,
  },
  detailActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryLabel: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 12,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  secondaryLabel: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 12,
  },
});
