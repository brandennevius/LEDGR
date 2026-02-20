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
import Svg, { Line, Polyline } from 'react-native-svg';
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

type CategoriesResponse = {
  categories?: string[];
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

const sanitizeAmountInput = (value: string) => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const [whole, ...decimals] = cleaned.split('.');
  if (decimals.length === 0) return whole;
  return `${whole}.${decimals.join('').slice(0, 2)}`;
};

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

const formatAxisCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

const formatReviewDay = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [reviewRows, setReviewRows] = useState<TransactionRow[]>([]);
  const [categoryChoices, setCategoryChoices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [categoryChoices, setCategoryChoices] = useState<string[]>([]);

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
  const [amountInput, setAmountInput] = useState('');
  const [editingAmount, setEditingAmount] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      // Keep requests serial to avoid saturating low-connection backend pool.
      const overviewData = await apiRequest<OverviewResponse>('/api/client/overview');
      const reviewData = await apiRequest<TransactionsResponse>(
        '/api/transactions?days=60&needsReview=true'
      );
      const categoriesData = await apiRequest<CategoriesResponse>('/api/categories');
      setOverview(overviewData);
      setReviewRows(reviewData.transactions ?? []);
      setCategoryChoices((categoriesData.categories ?? []).filter((name) => Boolean(name)));
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
  const yAxisWidth = 56;
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

    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([day, items]) => ({
        day,
        items,
      }));
  }, [reviewRows]);

  const latestReviewGroup = groupedReviewRows[0] ?? null;

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
        .slice(0, 5),
    [overview]
  );

  const openDetail = async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const detail = await apiRequest<TransactionDetail>(`/api/transactions/${id}`);
      setSelected(detail);
      setCategoryInput(detail.category ?? '');
      setAmountInput(String(Math.abs(detail.amount)));
      setEditingAmount(false);
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
    const isCategorizationDisabled = transactionTypeInput !== 'REGULAR';
    const parsedAmount = Number(amountInput);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setError('Enter a valid amount before saving.');
      return;
    }

    const signedAmount = parsedAmount * (selected.amount < 0 ? -1 : 1);
    setSavingDetail(true);
    try {
      await apiRequest(`/api/transactions/${selected.id}`, {
        method: 'PATCH',
        body: {
          amount: signedAmount,
          ...(isCategorizationDisabled ? {} : { category: categoryInput.trim() }),
          transactionType: transactionTypeInput,
          applyToSimilar,
          applyToCategory: isCategorizationDisabled ? false : applyToCategory,
          createRule: isCategorizationDisabled ? false : createRule,
          ruleMatchType,
          ruleMatchValue,
        },
      });
      setDetailOpen(false);
      await loadDashboard();
      setError(null);
    } catch (err) {
      const message =
        typeof err === 'object' && err && 'error' in err
          ? String((err as { error?: string }).error)
          : 'Unable to save transaction.';
      setError(message);
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
    const width = Math.max(0, event.nativeEvent.layout.width - yAxisWidth - 12);
    if (width !== chartWidth) setChartWidth(width);
  };

  const yAxisTicks = useMemo(
    () => [maxChartValue, maxChartValue * 0.75, maxChartValue * 0.5, maxChartValue * 0.25].map((value) => formatAxisCurrency(value)),
    [maxChartValue]
  );
  const xAxisTicks = useMemo(() => {
    const now = new Date();
    const days = chartSeries.daysInMonth;
    const midDay = Math.max(1, Math.round(days / 2));
    return [
      `${now.toLocaleDateString('en-US', { month: 'short' })} 1`,
      `${now.toLocaleDateString('en-US', { month: 'short' })} ${midDay}`,
      `${now.toLocaleDateString('en-US', { month: 'short' })} ${days}`,
    ];
  }, [chartSeries.daysInMonth]);

  const spent = overview?.monthSpendTotal ?? 0;
  const budget = overview?.monthBudgetTotal ?? 0;
  const budgetDiff = budget - spent;

  return (
    <Screen edgeToEdge>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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
          <View style={styles.chartFrame}>
            <View style={styles.chartBody} onLayout={onChartLayout}>
              <View style={[styles.yAxisColumn, { width: yAxisWidth }]}>
                {yAxisTicks.map((tick, index) => (
                  <Text key={`y-${index}-${tick}`} style={styles.yAxisTickLabel}>
                    {tick}
                  </Text>
                ))}
              </View>
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
            <View style={styles.xAxisRow}>
              {xAxisTicks.map((tick, index) => (
                <Text key={`x-${index}-${tick}`} style={styles.xAxisTickLabel}>
                  {tick}
                </Text>
              ))}
            </View>
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

          {groupedReviewRows.length === 0 || !latestReviewGroup ? (
            <Text style={styles.emptyText}>No transactions need review right now.</Text>
          ) : (
            <View key={latestReviewGroup.day} style={styles.reviewDayCard}>
              <Text style={styles.reviewDay}>{formatReviewDay(latestReviewGroup.day)}</Text>
              {latestReviewGroup.items.map((item) => (
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
              {latestReviewGroup.items.length > 1 ? (
                <Pressable style={styles.groupReviewButton} onPress={() => markGroupReviewed(latestReviewGroup.items)}>
                  <Text style={styles.groupReviewLabel}>Mark day as reviewed</Text>
                </Pressable>
              ) : null}
            </View>
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
            <View style={styles.budgetList}>
              {budgetItems.map((item) => {
                const ratio = item.budget > 0 ? item.spend / item.budget : 0;
                const progress = Math.max(0, Math.min(1, ratio));
                const remaining = item.budget - item.spend;
                const over = remaining < 0;
                const barColor = ratio > 1 ? '#ef4444' : ratio > 0.75 ? '#f59e0b' : '#22c55e';
                const remainingAmount = Math.abs(remaining);

                return (
                  <View key={item.name} style={styles.budgetRow}>
                    <View style={styles.budgetRowTop}>
                      <Text style={styles.budgetCategory} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.budgetAmounts}>
                        {formatCurrency(item.spend)} / {formatCurrency(item.budget)}
                      </Text>
                    </View>
                    <View style={styles.budgetTrack}>
                      <View
                        style={[
                          styles.budgetFill,
                          { width: `${Math.max(4, progress * 100)}%`, backgroundColor: barColor },
                        ]}
                      />
                    </View>
                    <Text style={[styles.budgetDelta, over ? styles.negative : styles.positive]}>
                      {formatCurrency(remainingAmount)} {over ? 'over' : 'left'}
                    </Text>
                  </View>
                );
              })}
            </View>
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
          <ScrollView contentContainerStyle={styles.detailContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.detailHeader}>Transaction to review</Text>
            <Text style={styles.detailDate}>{new Date(selected.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
            <Text style={styles.detailTitle}>{selected.name}</Text>
            {editingAmount ? (
              <TextInput
                value={amountInput}
                onChangeText={(value) => setAmountInput(sanitizeAmountInput(value))}
                style={styles.amountInput}
                keyboardType="decimal-pad"
                autoFocus
                selectTextOnFocus
              />
            ) : (
              <Pressable onPress={() => setEditingAmount(true)}>
                <Text style={styles.detailAmount}>
                  {selected.amount < 0 ? '+' : '-'}
                  {formatCurrency(Math.abs(selected.amount), 2)}
                </Text>
                <Text style={styles.detailAmountHint}>Tap amount to edit</Text>
              </Pressable>
            )}
            <Text style={styles.detailAccount}>
              {selected.account?.institutionName ?? 'Account'} · {selected.account?.name ?? 'Linked account'}
            </Text>

            <Text style={styles.detailSectionTitle}>Category</Text>
            {transactionTypeInput !== 'REGULAR' ? (
              <Text style={styles.loadingText}>Categories are only available for regular transactions.</Text>
            ) : (
              <>
                <TextInput
                  value={categoryInput}
                  onChangeText={setCategoryInput}
                  placeholder="Category"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  blurOnSubmit={false}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterRow}
                  keyboardShouldPersistTaps="handled"
                >
                  {categoryChoices.map((category) => (
                    <Chip
                      key={category}
                      label={category}
                      active={categoryInput.trim().toLowerCase() === category.toLowerCase()}
                      onPress={() => setCategoryInput(category)}
                    />
                  ))}
                </ScrollView>
              </>
            )}

            <Text style={styles.detailSectionTitle}>Transaction type</Text>
            <View style={styles.filterRow}>
              {(['REGULAR', 'INCOME', 'INTERNAL_TRANSFER'] as const).map((type) => (
                <Chip
                  key={type}
                  label={type.replace('_', ' ')}
                  active={transactionTypeInput === type}
                  onPress={() => {
                    setTransactionTypeInput(type);
                    if (type !== 'REGULAR') {
                      setCategoryInput('');
                      setApplyToCategory(false);
                      setCreateRule(false);
                    }
                  }}
                />
              ))}
            </View>

            <View style={styles.filterRow}>
              <Chip
                label={applyToSimilar ? 'Apply similar ✓' : 'Apply similar'}
                active={applyToSimilar}
                onPress={() => setApplyToSimilar((prev) => !prev)}
              />
              {transactionTypeInput === 'REGULAR' ? (
                <Chip
                  label={applyToCategory ? 'Apply category ✓' : 'Apply category'}
                  active={applyToCategory}
                  onPress={() => setApplyToCategory((prev) => !prev)}
                />
              ) : null}
              {transactionTypeInput === 'REGULAR' ? (
                <Chip
                  label={createRule ? 'Create rule ✓' : 'Create rule'}
                  active={createRule}
                  onPress={() => setCreateRule((prev) => !prev)}
                />
              ) : null}
            </View>

            {createRule && transactionTypeInput === 'REGULAR' ? (
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
    paddingTop: 8,
    paddingHorizontal: 14,
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
  chartBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  yAxisColumn: {
    height: 190,
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 22,
  },
  yAxisTickLabel: {
    color: colors.textMuted,
    fontSize: 10,
  },
  xAxisRow: {
    marginTop: 2,
    marginLeft: 64,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  xAxisTickLabel: {
    color: colors.textMuted,
    fontSize: 10,
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
  budgetList: {
    gap: 8,
  },
  budgetRow: {
    gap: 5,
  },
  budgetRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  budgetCategory: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    textTransform: 'uppercase',
  },
  budgetAmounts: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  budgetTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  budgetFill: {
    height: '100%',
    borderRadius: 999,
  },
  budgetDelta: {
    fontSize: 11,
    fontWeight: '600',
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
  detailAmountHint: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: 'rgba(9, 13, 27, 0.7)',
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
