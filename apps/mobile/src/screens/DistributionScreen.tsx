import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Screen } from '../components/Screen';
import { apiRequest } from '../lib/api';
import { colors } from '../theme';

type CashFlowType = 'income' | 'spend' | 'internal_transfer' | 'transfer' | 'investment';
type MetricKey = 'net' | 'spend' | 'income';
type RangeKey = 'mtd' | 'ytd' | '12m' | '3m' | '4w';

type CashFlowTx = {
  id: string;
  date: string;
  name: string;
  category: string;
  amount: number;
  type: CashFlowType;
  excluded?: boolean;
};

type DistributionResponse = {
  rangeLabel: string;
  incomeTotal: number;
  spendTotal: number;
  savings: number;
  cashFlowTransactions?: CashFlowTx[];
};

type BucketData = {
  key: string;
  label: string;
  start: Date;
  end: Date;
  income: number;
  spend: number;
  net: number;
  spendByCategory: Array<{ name: string; value: number }>;
  incomeTx: CashFlowTx[];
  spendTx: CashFlowTx[];
};

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: 'mtd', label: 'MTD' },
  { key: 'ytd', label: 'YTD' },
  { key: '12m', label: '12M' },
  { key: '3m', label: '3M' },
  { key: '4w', label: '4W' },
];

const STACK_PALETTE = ['#38bdf8', '#22c55e', '#f59e0b', '#a78bfa', '#f97316', '#f43f5e', '#14b8a6'];

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

const formatShortCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  });

const pct = (value: number) => `${Math.round(value)}%`;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const daysBetweenInclusive = (start: Date, end: Date) =>
  Math.max(1, Math.floor((endOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000) + 1);

const categoryColor = (name: string) => {
  const key = name.trim().toLowerCase();
  if (!key) return STACK_PALETTE[0];
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return STACK_PALETTE[hash % STACK_PALETTE.length];
};

const getRangeBounds = (range: RangeKey, now: Date) => {
  if (range === 'mtd') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now, granularity: 'week' as const };
  }
  if (range === 'ytd') {
    return { start: new Date(now.getFullYear(), 0, 1), end: now, granularity: 'month' as const };
  }
  if (range === '12m') {
    return { start: new Date(now.getFullYear(), now.getMonth() - 11, 1), end: now, granularity: 'month' as const };
  }
  if (range === '3m') {
    return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1), end: now, granularity: 'month' as const };
  }
  return { start: addDays(now, -27), end: now, granularity: 'week' as const };
};

const buildIntervals = (start: Date, end: Date, granularity: 'month' | 'week') => {
  const intervals: Array<{ start: Date; end: Date; key: string; label: string }> = [];
  if (granularity === 'month') {
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const clippedStart = monthStart < start ? start : monthStart;
      const clippedEnd = monthEnd > end ? end : monthEnd;
      intervals.push({
        start: clippedStart,
        end: clippedEnd,
        key: `${cursor.getFullYear()}-${cursor.getMonth() + 1}`,
        label: cursor.toLocaleDateString('en-US', { month: 'short' }),
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return intervals;
  }

  let cursor = startOfDay(start);
  let weekIndex = 1;
  while (cursor <= end) {
    const bucketStart = cursor;
    const bucketEnd = addDays(bucketStart, 6) > end ? end : addDays(bucketStart, 6);
    intervals.push({
      start: bucketStart,
      end: bucketEnd,
      key: `${bucketStart.toISOString()}-${bucketEnd.toISOString()}`,
      label: `W${weekIndex}`,
    });
    weekIndex += 1;
    cursor = addDays(bucketEnd, 1);
  }
  return intervals;
};

const buildBuckets = (transactions: CashFlowTx[], start: Date, end: Date, granularity: 'month' | 'week') => {
  const intervals = buildIntervals(start, end, granularity);

  const buckets = intervals.map((interval) => ({
    ...interval,
    income: 0,
    spend: 0,
    net: 0,
    spendMap: new Map<string, number>(),
    incomeTx: [] as CashFlowTx[],
    spendTx: [] as CashFlowTx[],
  }));

  const inRangeTransactions = transactions
    .map((tx) => ({ ...tx, parsedDate: new Date(tx.date) }))
    .filter((tx) => tx.parsedDate >= start && tx.parsedDate <= end);

  inRangeTransactions.forEach((tx) => {
    const bucket = buckets.find((item) => tx.parsedDate >= item.start && tx.parsedDate <= item.end);
    if (!bucket) return;

    if (tx.type === 'income') {
      bucket.income += tx.amount;
      bucket.incomeTx.push(tx);
    }
    if (tx.type === 'spend') {
      bucket.spend += tx.amount;
      bucket.spendTx.push(tx);
      bucket.spendMap.set(tx.category, (bucket.spendMap.get(tx.category) ?? 0) + tx.amount);
    }
  });

  return buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    start: bucket.start,
    end: bucket.end,
    income: bucket.income,
    spend: bucket.spend,
    net: bucket.income - bucket.spend,
    spendByCategory: Array.from(bucket.spendMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    incomeTx: bucket.incomeTx.sort((a, b) => b.amount - a.amount),
    spendTx: bucket.spendTx.sort((a, b) => b.amount - a.amount),
  }));
};

export function DistributionScreen() {
  const [data, setData] = useState<DistributionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>('mtd');
  const [compareOn, setCompareOn] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('net');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const response = await apiRequest<DistributionResponse>('/api/distribution');
        if (isMounted) {
          setData(response);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          const message =
            typeof err === 'object' && err && 'error' in err
              ? String((err as { error?: string }).error)
              : 'Unable to load cash flow.';
          setError(message);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const rows = useMemo(() => data?.cashFlowTransactions ?? [], [data?.cashFlowTransactions]);

  const rangeData = useMemo(() => {
    const now = new Date();
    const { start, end, granularity } = getRangeBounds(range, now);
    const current = buildBuckets(rows, start, end, granularity);

    const durationDays = daysBetweenInclusive(start, end);
    const prevEnd = addDays(start, -1);
    const prevStart = addDays(prevEnd, -(durationDays - 1));
    const previous = buildBuckets(rows, prevStart, prevEnd, granularity);

    return { start, end, current, previous };
  }, [range, rows]);

  useEffect(() => {
    const maxIndex = Math.max(0, rangeData.current.length - 1);
    if (selectedIndex > maxIndex) {
      setSelectedIndex(maxIndex);
    }
  }, [rangeData.current.length, selectedIndex]);

  const totals = useMemo(() => {
    const income = rangeData.current.reduce((sum, bucket) => sum + bucket.income, 0);
    const spend = rangeData.current.reduce((sum, bucket) => sum + bucket.spend, 0);
    const net = income - spend;

    const previousIncome = rangeData.previous.reduce((sum, bucket) => sum + bucket.income, 0);
    const previousSpend = rangeData.previous.reduce((sum, bucket) => sum + bucket.spend, 0);
    const previousNet = previousIncome - previousSpend;

    return {
      income,
      spend,
      net,
      previousIncome,
      previousSpend,
      previousNet,
    };
  }, [rangeData.current, rangeData.previous]);

  const selectedBucket = rangeData.current[selectedIndex] ?? null;
  const compareBucket = rangeData.previous[selectedIndex] ?? null;

  const topSpendCategories = useMemo(() => {
    const map = new Map<string, number>();
    rangeData.current.forEach((bucket) => {
      bucket.spendByCategory.forEach((item) => {
        map.set(item.name, (map.get(item.name) ?? 0) + item.value);
      });
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [rangeData.current]);

  const chartMax = useMemo(() => {
    const values = rangeData.current.flatMap((bucket) => [bucket.income, bucket.spend, Math.abs(bucket.net)]);
    const compareValues = rangeData.previous.flatMap((bucket) => [bucket.income, bucket.spend, Math.abs(bucket.net)]);
    return Math.max(1, ...values, ...compareValues);
  }, [rangeData.current, rangeData.previous]);

  const renderMetricCard = (metric: MetricKey, title: string, value: number, previousValue: number) => {
    const delta = value - previousValue;
    const deltaPct = previousValue > 0 ? (delta / previousValue) * 100 : 0;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardValue}>{formatCurrency(value)}</Text>
        </View>
        {compareOn ? (
          <Text style={styles.cardMeta}>
            {delta >= 0 ? '+' : ''}
            {formatShortCurrency(delta)} vs prior ({pct(deltaPct)})
          </Text>
        ) : (
          <Text style={styles.cardMeta}>Comparison hidden</Text>
        )}

        <View style={styles.chartRow}>
          {rangeData.current.map((bucket, index) => {
            const currentValue = metric === 'income' ? bucket.income : metric === 'spend' ? bucket.spend : Math.abs(bucket.net);
            const prevValue = metric === 'income'
              ? rangeData.previous[index]?.income ?? 0
              : metric === 'spend'
                ? rangeData.previous[index]?.spend ?? 0
                : Math.abs(rangeData.previous[index]?.net ?? 0);

            const barHeight = Math.max(6, Math.round((currentValue / chartMax) * 96));
            const compareHeight = Math.max(4, Math.round((prevValue / chartMax) * 96));
            const isSelected = selectedMetric === metric && selectedIndex === index;

            return (
              <Pressable
                key={`${metric}-${bucket.key}`}
                style={[styles.barPressable, isSelected && styles.barPressableSelected]}
                onPress={() => {
                  setSelectedMetric(metric);
                  setSelectedIndex(index);
                }}
              >
                <View style={styles.barTrack}>
                  {compareOn ? <View style={[styles.compareBar, { height: compareHeight }]} /> : null}
                  {metric === 'spend' && currentValue > 0 ? (
                    <View style={[styles.stackBar, { height: barHeight }]}> 
                      {topSpendCategories.map((category) => {
                        const segmentValue = bucket.spendByCategory.find((item) => item.name === category.name)?.value ?? 0;
                        if (segmentValue <= 0) return null;
                        return (
                          <View
                            key={`${bucket.key}-${category.name}`}
                            style={{
                              flex: segmentValue,
                              backgroundColor: categoryColor(category.name),
                              width: '100%',
                            }}
                          />
                        );
                      })}
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.valueBar,
                        { height: barHeight },
                        metric === 'income'
                          ? styles.incomeBar
                          : metric === 'spend'
                            ? styles.spendBar
                            : bucket.net < 0
                              ? styles.netNegativeBar
                              : styles.netPositiveBar,
                      ]}
                    />
                  )}
                </View>
                <Text style={styles.barLabel}>{bucket.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const detailTitle = selectedBucket
    ? `${selectedMetric === 'net' ? 'Net' : selectedMetric === 'spend' ? 'Spend' : 'Income'} · ${selectedBucket.label}`
    : 'Details';

  const detailValue = selectedBucket
    ? selectedMetric === 'net'
      ? selectedBucket.net
      : selectedMetric === 'spend'
        ? selectedBucket.spend
        : selectedBucket.income
    : 0;

  const detailCompare = compareBucket
    ? selectedMetric === 'net'
      ? compareBucket.net
      : selectedMetric === 'spend'
        ? compareBucket.spend
        : compareBucket.income
    : 0;

  const detailTransactions = useMemo(() => {
    if (!selectedBucket) return [] as CashFlowTx[];
    if (selectedMetric === 'income') return selectedBucket.incomeTx.slice(0, 8);
    if (selectedMetric === 'spend') return selectedBucket.spendTx.slice(0, 8);
    return [...selectedBucket.spendTx, ...selectedBucket.incomeTx]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [selectedBucket, selectedMetric]);

  const detailCategories = useMemo(() => {
    if (!selectedBucket || selectedMetric !== 'spend') return [] as Array<{ name: string; value: number }>;
    return selectedBucket.spendByCategory.slice(0, 6);
  }, [selectedBucket, selectedMetric]);

  return (
    <Screen edgeToEdge>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading cash flow...</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.controlsRow}>
          <View>
            <Text style={styles.rangeLabel}>
              {rangeData.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
              {rangeData.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          </View>
          <Pressable
            onPress={() => setCompareOn((prev) => !prev)}
            style={[styles.compareToggle, compareOn && styles.compareToggleActive]}
          >
            <Text style={[styles.compareToggleLabel, compareOn && styles.compareToggleLabelActive]}>
              {compareOn ? 'Comparison on' : 'Comparison off'}
            </Text>
          </Pressable>
        </View>

        {renderMetricCard('net', 'Net income', totals.net, totals.previousNet)}
        {renderMetricCard('spend', 'Spending', totals.spend, totals.previousSpend)}
        {renderMetricCard('income', 'Income', totals.income, totals.previousIncome)}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{detailTitle}</Text>
          <Text style={styles.cardValue}>{formatCurrency(detailValue)}</Text>
          {compareOn ? <Text style={styles.cardMeta}>Previous period: {formatCurrency(detailCompare)}</Text> : null}

          {detailCategories.length > 0 ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Category breakdown</Text>
              {detailCategories.map((category) => {
                const ratio = detailValue > 0 ? (category.value / detailValue) * 100 : 0;
                return (
                  <View key={`${selectedBucket?.key}-${category.name}`} style={styles.categoryRow}>
                    <View style={[styles.categoryDot, { backgroundColor: categoryColor(category.name) }]} />
                    <Text style={styles.categoryName}>{category.name}</Text>
                    <Text style={styles.categoryAmount}>{formatCurrency(category.value)}</Text>
                    <Text style={styles.categoryPct}>{pct(ratio)}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Transactions</Text>
            {detailTransactions.length > 0 ? (
              detailTransactions.map((tx) => (
                <View key={`${selectedMetric}-${tx.id}`} style={styles.txRow}>
                  <View style={styles.txLeft}>
                    <Text style={styles.txName} numberOfLines={1}>{tx.name}</Text>
                    <Text style={styles.txMeta}>{tx.category}</Text>
                  </View>
                  <Text style={styles.txAmount}>{formatCurrency(tx.amount)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No transactions in this bucket.</Text>
            )}
          </View>
        </View>

        <View style={styles.rangeSelector}>
          {RANGE_OPTIONS.map((option) => (
            <Pressable
              key={option.key}
              onPress={() => {
                setRange(option.key);
                setSelectedIndex(0);
              }}
              style={[styles.rangeChip, range === option.key && styles.rangeChipActive]}
            >
              <Text style={[styles.rangeChipLabel, range === option.key && styles.rangeChipLabelActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
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
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rangeLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  compareToggle: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  compareToggleActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
  },
  compareToggleLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  compareToggleLabelActive: {
    color: colors.text,
  },
  card: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  cardValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  cardMeta: {
    color: colors.textMuted,
    fontSize: 11,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: 4,
  },
  barPressable: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  barPressableSelected: {
    opacity: 1,
  },
  barTrack: {
    width: '100%',
    height: 96,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  compareBar: {
    position: 'absolute',
    left: '28%',
    right: '28%',
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  valueBar: {
    width: '100%',
    borderRadius: 8,
  },
  incomeBar: {
    backgroundColor: '#22c55e',
  },
  spendBar: {
    backgroundColor: '#38bdf8',
  },
  netPositiveBar: {
    backgroundColor: '#a78bfa',
  },
  netNegativeBar: {
    backgroundColor: '#ef4444',
  },
  stackBar: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  detailSection: {
    marginTop: 6,
    gap: 8,
  },
  detailSectionTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  categoryName: {
    color: colors.text,
    fontSize: 12,
    flex: 1,
  },
  categoryAmount: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  categoryPct: {
    color: colors.textMuted,
    fontSize: 11,
    width: 42,
    textAlign: 'right',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  txLeft: {
    flex: 1,
    marginRight: 8,
  },
  txName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  txMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  txAmount: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  rangeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  rangeChip: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 8,
  },
  rangeChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  rangeChipLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  rangeChipLabelActive: {
    color: colors.text,
  },
});
