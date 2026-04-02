import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ModalSheet from '../components/ModalSheet';
import { Screen } from '../components/Screen';
import { apiRequest } from '../lib/api';
import { colors } from '../theme';

type CashFlowType = 'income' | 'spend' | 'internal_transfer' | 'transfer' | 'investment';
type MetricKey = 'net' | 'spend' | 'income';
type RangeKey = '4w' | '3m' | 'ytd' | '12m' | 'mtd';
type Granularity = 'day' | 'week' | 'month';

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
  { key: '4w', label: '4W' },
  { key: '3m', label: '3M' },
  { key: 'ytd', label: 'YTD' },
  { key: '12m', label: '1Y' },
  { key: 'mtd', label: 'MTD' },
];

const STACK_PALETTE = ['#38bdf8', '#22c55e', '#f59e0b', '#a78bfa', '#f97316', '#f43f5e', '#14b8a6'];

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

const formatPct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

const formatDateRange = (start: Date, end: Date) => {
  const sameYear = start.getFullYear() === end.getFullYear();
  const startFmt = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const endFmt = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startFmt} - ${endFmt}`;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

// Server dates are ISO/UTC; normalize to local calendar-day noon to avoid timezone
// shifts pushing rows into the wrong month/week bucket.
const normalizeTxDate = (raw: string) => {
  const day = raw.slice(0, 10);
  return new Date(`${day}T12:00:00`);
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
  const normalizedEnd = endOfDay(now);
  if (range === 'mtd') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: normalizedEnd,
      granularity: 'day' as Granularity,
    };
  }
  if (range === 'ytd') {
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end: normalizedEnd,
      granularity: 'month' as Granularity,
    };
  }
  if (range === '12m') {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 11, 1),
      end: normalizedEnd,
      granularity: 'month' as Granularity,
    };
  }
  if (range === '3m') {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 2, 1),
      end: normalizedEnd,
      granularity: 'week' as Granularity,
    };
  }
  return {
    start: startOfDay(addDays(now, -27)),
    end: normalizedEnd,
    granularity: 'day' as Granularity,
  };
};

const buildIntervals = (start: Date, end: Date, granularity: Granularity) => {
  const intervals: Array<{ start: Date; end: Date; key: string; label: string }> = [];

  if (granularity === 'month') {
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const clippedStart = monthStart < start ? start : monthStart;
      const clippedEnd = monthEnd > end ? endOfDay(end) : endOfDay(monthEnd);
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

  if (granularity === 'week') {
    let cursor = startOfDay(start);
    let weekIndex = 1;
    while (cursor <= end) {
      const bucketStart = cursor;
      const bucketEnd = addDays(bucketStart, 6) > end ? endOfDay(end) : endOfDay(addDays(bucketStart, 6));
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
  }

  let cursor = startOfDay(start);
  while (cursor <= end) {
    intervals.push({
      start: cursor,
      end: endOfDay(cursor),
      key: cursor.toISOString(),
      label: cursor.toLocaleDateString('en-US', { day: 'numeric' }),
    });
    cursor = addDays(cursor, 1);
  }
  return intervals;
};

const buildBuckets = (transactions: CashFlowTx[], start: Date, end: Date, granularity: Granularity): BucketData[] => {
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
    .map((tx) => ({ ...tx, parsedDate: normalizeTxDate(tx.date) }))
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

const metricValue = (bucket: BucketData, metric: MetricKey) =>
  metric === 'income' ? bucket.income : metric === 'spend' ? bucket.spend : bucket.net;

const metricColor = (metric: MetricKey, value: number) => {
  if (metric === 'income') return '#22c55e';
  if (metric === 'spend') return '#f97316';
  return value < 0 ? '#ef4444' : '#22c55e';
};

type MetricCardProps = {
  metric: MetricKey;
  title: string;
  currentBuckets: BucketData[];
  previousBuckets: BucketData[];
  currentValue: number;
  previousValue: number;
  currentRangeText: string;
  previousRangeText: string;
  spendTop: Array<{ name: string; value: number }>;
  spendKeys: string[];
  onBarPress: (index: number) => void;
};

function MetricCard({
  metric,
  title,
  currentBuckets,
  previousBuckets,
  currentValue,
  previousValue,
  currentRangeText,
  previousRangeText,
  spendTop,
  spendKeys,
  onBarPress,
}: MetricCardProps) {
  const delta = currentValue - previousValue;
  const deltaPct = previousValue !== 0 ? (delta / Math.abs(previousValue)) * 100 : 0;

  const absMax = useMemo(() => {
    const values = currentBuckets.map((bucket, index) => {
      const current = Math.abs(metricValue(bucket, metric));
      const prior = Math.abs(metricValue(previousBuckets[index] ?? bucket, metric));
      return Math.max(current, prior);
    });
    return Math.max(1, ...values);
  }, [currentBuckets, metric, previousBuckets]);

  const yTop = metric === 'net' ? formatCurrency(absMax) : formatCurrency(absMax);
  const yMid = metric === 'net' ? '$0' : formatCurrency(absMax / 2);
  const yBottom = metric === 'net' ? `-${formatCurrency(absMax).replace('$', '$')}` : '$0';

  const isNet = metric === 'net';
  const barHeight = 126;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardRange}>{currentRangeText}</Text>
      <Text style={styles.cardValue}>{formatCurrency(currentValue)}</Text>
      <View style={[styles.deltaPill, delta >= 0 ? styles.deltaPositive : styles.deltaNegative]}>
        <Text style={[styles.deltaPillText, delta >= 0 ? styles.deltaPositiveText : styles.deltaNegativeText]}>
          {formatPct(deltaPct)}
        </Text>
      </View>
      <Text style={styles.compareText}>vs {formatCurrency(previousValue)} in {previousRangeText}</Text>

      <View style={styles.chartWrap}>
        <View style={styles.yAxis}>
          <Text style={styles.yLabel}>{yTop}</Text>
          <Text style={styles.yLabel}>{yMid}</Text>
          <Text style={styles.yLabel}>{yBottom}</Text>
        </View>

        <View style={styles.chartArea}>
          <View style={[styles.gridLine, { top: 0 }]} />
          <View style={[styles.gridLine, { top: barHeight / 2 }]} />
          <View style={[styles.gridLine, { top: barHeight }]} />

          {isNet ? <View style={[styles.zeroLine, { top: barHeight / 2 }]} /> : null}

          <View style={styles.barRow}>
            {currentBuckets.map((bucket, index) => {
              const value = metricValue(bucket, metric);
              const prior = metricValue(previousBuckets[index] ?? bucket, metric);
              const columnHeight = isNet
                ? Math.max(2, Math.round((Math.abs(value) / absMax) * (barHeight / 2)))
                : Math.max(2, Math.round((Math.abs(value) / absMax) * barHeight));
              const priorHeight = isNet
                ? Math.max(2, Math.round((Math.abs(prior) / absMax) * (barHeight / 2)))
                : Math.max(2, Math.round((Math.abs(prior) / absMax) * barHeight));

              return (
                <Pressable key={`${metric}-${bucket.key}`} style={styles.barPressable} onPress={() => onBarPress(index)}>
                  <View style={styles.barColumn}>
                    {isNet ? (
                      <>
                        <View
                          style={[
                            styles.priorTick,
                            {
                              height: priorHeight,
                              bottom: prior >= 0 ? barHeight / 2 : barHeight / 2 - priorHeight,
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.metricBar,
                            {
                              height: columnHeight,
                              backgroundColor: metricColor(metric, value),
                              bottom: value >= 0 ? barHeight / 2 : barHeight / 2 - columnHeight,
                            },
                          ]}
                        />
                      </>
                    ) : metric === 'spend' ? (
                      <>
                        <View style={[styles.priorTick, { height: priorHeight, bottom: 0 }]} />
                        <View style={[styles.metricBarBase, { height: columnHeight }]}> 
                          {spendKeys.map((key) => {
                            const topFiveNames = spendTop.map((item) => item.name);
                            const segmentValue =
                              key === '__other__'
                                ? Math.max(
                                    0,
                                    bucket.spend -
                                      bucket.spendByCategory
                                        .filter((item) => topFiveNames.includes(item.name))
                                        .reduce((sum, item) => sum + item.value, 0)
                                  )
                                : bucket.spendByCategory.find((item) => item.name === key)?.value ?? 0;
                            if (segmentValue <= 0) return null;
                            return (
                              <View
                                key={`${bucket.key}-${key}`}
                                style={{
                                  flex: segmentValue,
                                  width: '100%',
                                  backgroundColor:
                                    key === '__other__'
                                      ? (colors.cardBorderStrong as string)
                                      : categoryColor(key),
                                }}
                              />
                            );
                          })}
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={[styles.priorTick, { height: priorHeight, bottom: 0 }]} />
                        <View
                          style={[
                            styles.metricBar,
                            {
                              height: columnHeight,
                              bottom: 0,
                              backgroundColor: metricColor(metric, value),
                            },
                          ]}
                        />
                      </>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.xAxisRow}>
            <Text style={styles.xLabel}>{currentBuckets[0]?.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
            <Text style={styles.xLabel}>
              {currentBuckets[Math.floor((currentBuckets.length - 1) / 2)]?.start.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </Text>
            <Text style={styles.xLabel}>{currentBuckets[currentBuckets.length - 1]?.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
          </View>
        </View>
      </View>

      {metric === 'spend' ? (
        <View style={styles.topCategoryBlock}>
          <Text style={styles.topCategoryTitle}>Top categories</Text>
          {spendTop.map((item) => (
            <View key={item.name} style={styles.topCategoryRow}>
              <View
                style={[
                  styles.categoryDot,
                  {
                    backgroundColor:
                      item.name === 'All other categories'
                        ? (colors.cardBorderStrong as string)
                        : categoryColor(item.name),
                  },
                ]}
              />
              <Text style={styles.topCategoryName}>{item.name}</Text>
              <Text style={styles.topCategoryAmount}>{formatCurrency(item.value)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function DistributionScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<DistributionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>('mtd');
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('net');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const load = async () => {
        setLoading(true);
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
      void load();
      return () => {
        isMounted = false;
      };
    }, [])
  );

  const rows = useMemo(() => data?.cashFlowTransactions ?? [], [data?.cashFlowTransactions]);
  const rangeAnchor = useMemo(() => {
    if (!rows.length) return new Date();
    const rangeRows = rows.filter((tx) => tx.type === 'income' || tx.type === 'spend');
    const source = rangeRows.length ? rangeRows : rows;
    const latest = source.reduce((max, tx) => {
      const parsed = normalizeTxDate(tx.date).getTime();
      return parsed > max ? parsed : max;
    }, 0);
    return new Date(latest || Date.now());
  }, [rows]);

  const rangeData = useMemo(() => {
    const { start, end, granularity } = getRangeBounds(range, rangeAnchor);
    const current = buildBuckets(rows, start, end, granularity);

    const durationDays = daysBetweenInclusive(start, end);
    const prevEnd = addDays(start, -1);
    const prevStart = addDays(prevEnd, -(durationDays - 1));
    const previous = buildBuckets(rows, prevStart, prevEnd, granularity);

    return { start, end, prevStart, prevEnd, current, previous };
  }, [range, rows, rangeAnchor]);
  const currentBuckets = rangeData.current;
  const previousBuckets = rangeData.previous;

  useEffect(() => {
    const maxIndex = Math.max(0, currentBuckets.length - 1);
    if (selectedIndex > maxIndex) {
      setSelectedIndex(maxIndex);
    }
  }, [currentBuckets, selectedIndex]);

  const totals = useMemo(() => {
    const income = currentBuckets.reduce((sum, bucket) => sum + bucket.income, 0);
    const spend = currentBuckets.reduce((sum, bucket) => sum + bucket.spend, 0);
    const net = income - spend;

    const previousIncome = previousBuckets.reduce((sum, bucket) => sum + bucket.income, 0);
    const previousSpend = previousBuckets.reduce((sum, bucket) => sum + bucket.spend, 0);
    const previousNet = previousIncome - previousSpend;

    return {
      income,
      spend,
      net,
      previousIncome,
      previousSpend,
      previousNet,
    };
  }, [currentBuckets, previousBuckets]);

  const spendTopSix = useMemo(() => {
    const map = new Map<string, number>();
    currentBuckets.forEach((bucket) => {
      bucket.spendByCategory.forEach((item) => {
        map.set(item.name, (map.get(item.name) ?? 0) + item.value);
      });
    });
    const sorted = Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const topFive = sorted.slice(0, 5);
    const otherTotal = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);
    if (otherTotal > 0) {
      topFive.push({ name: 'All other categories', value: otherTotal });
    }
    return topFive;
  }, [currentBuckets]);

  const spendKeys = useMemo(() => {
    const topNames = spendTopSix
      .filter((item) => item.name !== 'All other categories')
      .map((item) => item.name);
    if (spendTopSix.some((item) => item.name === 'All other categories')) {
      return [...topNames, '__other__'];
    }
    return topNames;
  }, [spendTopSix]);

  const selectedBucket = currentBuckets[selectedIndex] ?? null;
  const compareBucket = previousBuckets[selectedIndex] ?? null;

  const detailTransactions = useMemo(() => {
    if (!selectedBucket) return [] as CashFlowTx[];
    if (selectedMetric === 'income') return selectedBucket.incomeTx;
    if (selectedMetric === 'spend') return selectedBucket.spendTx;
    return [...selectedBucket.spendTx, ...selectedBucket.incomeTx].sort((a, b) => b.amount - a.amount);
  }, [selectedBucket, selectedMetric]);

  const detailCategories = useMemo(() => {
    if (!selectedBucket || selectedMetric !== 'spend') return [] as Array<{ name: string; value: number }>;
    const sorted = selectedBucket.spendByCategory.slice().sort((a, b) => b.value - a.value);
    const topFive = sorted.slice(0, 5);
    const otherTotal = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);
    if (otherTotal > 0) {
      topFive.push({ name: 'All other categories', value: otherTotal });
    }
    return topFive;
  }, [selectedBucket, selectedMetric]);

  const currentRangeText = formatDateRange(rangeData.start, rangeData.end);
  const previousRangeText = formatDateRange(rangeData.prevStart, rangeData.prevEnd);
  return (
    <Screen edgeToEdge>
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 110 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>Loading cash flow...</Text>
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <MetricCard
            metric="net"
            title="Net income"
            currentBuckets={currentBuckets}
            previousBuckets={previousBuckets}
            currentValue={totals.net}
            previousValue={totals.previousNet}
            currentRangeText={currentRangeText}
            previousRangeText={previousRangeText}
            spendTop={spendTopSix}
            spendKeys={spendKeys}
            onBarPress={(index) => {
              setSelectedMetric('net');
              setSelectedIndex(index);
              setDetailOpen(true);
            }}
          />

          <MetricCard
            metric="spend"
            title="Spend"
            currentBuckets={currentBuckets}
            previousBuckets={previousBuckets}
            currentValue={totals.spend}
            previousValue={totals.previousSpend}
            currentRangeText={currentRangeText}
            previousRangeText={previousRangeText}
            spendTop={spendTopSix}
            spendKeys={spendKeys}
            onBarPress={(index) => {
              setSelectedMetric('spend');
              setSelectedIndex(index);
              setDetailOpen(true);
            }}
          />

          <MetricCard
            metric="income"
            title="Income"
            currentBuckets={currentBuckets}
            previousBuckets={previousBuckets}
            currentValue={totals.income}
            previousValue={totals.previousIncome}
            currentRangeText={currentRangeText}
            previousRangeText={previousRangeText}
            spendTop={spendTopSix}
            spendKeys={spendKeys}
            onBarPress={(index) => {
              setSelectedMetric('income');
              setSelectedIndex(index);
              setDetailOpen(true);
            }}
          />
        </ScrollView>

        <View style={[styles.rangeDock, { bottom: 8 + insets.bottom }]}>
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
      </View>

      <ModalSheet visible={detailOpen} onClose={() => setDetailOpen(false)}>
        <View style={styles.sheetGrip} />
        <Text style={styles.sheetTitle}>
          {selectedMetric === 'net' ? 'Net income' : selectedMetric === 'spend' ? 'Spend' : 'Income'} ·{' '}
          {selectedBucket ? formatDateRange(selectedBucket.start, selectedBucket.end) : ''}
        </Text>
        {selectedBucket ? (
          <Text style={styles.sheetValue}>{formatCurrency(metricValue(selectedBucket, selectedMetric))}</Text>
        ) : null}
        {compareBucket ? (
          <Text style={styles.sheetMeta}>Prior: {formatCurrency(metricValue(compareBucket, selectedMetric))}</Text>
        ) : null}

        {detailCategories.length > 0 ? (
          <View style={styles.sheetSection}>
            <Text style={styles.sheetSectionTitle}>Categories</Text>
            {detailCategories.map((item) => (
              <View key={item.name} style={styles.sheetRow}>
                <View
                  style={[
                    styles.categoryDot,
                    {
                      backgroundColor:
                        item.name === 'All other categories'
                          ? (colors.cardBorderStrong as string)
                          : categoryColor(item.name),
                    },
                  ]}
                />
                <Text style={styles.sheetRowLabel}>{item.name}</Text>
                <Text style={styles.sheetRowValue}>{formatCurrency(item.value)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.sheetSection}>
          <Text style={styles.sheetSectionTitle}>Transactions</Text>
          {detailTransactions.length ? (
            <ScrollView style={styles.sheetTxList} contentContainerStyle={styles.sheetTxListContent}>
              {detailTransactions.map((tx) => (
                <View key={`${selectedMetric}-${tx.id}`} style={styles.sheetTxRow}>
                  <View style={styles.sheetTxLeft}>
                    <Text numberOfLines={1} style={styles.sheetTxName}>{tx.name}</Text>
                    <Text style={styles.sheetTxMeta}>{tx.category}</Text>
                  </View>
                  <Text style={styles.sheetTxAmount}>{formatCurrency(tx.amount)}</Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.sheetEmpty}>No transactions in this bar.</Text>
          )}
        </View>
      </ModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
    gap: 14,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.surface,
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
    paddingHorizontal: 2,
  },
  card: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 6,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardRange: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  cardValue: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
  },
  deltaPill: {
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  deltaPositive: {
    backgroundColor: colors.successSoft,
  },
  deltaNegative: {
    backgroundColor: colors.dangerSoft,
  },
  deltaPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  deltaPositiveText: {
    color: colors.success,
  },
  deltaNegativeText: {
    color: colors.danger,
  },
  compareText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 2,
  },
  chartWrap: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  yAxis: {
    width: 44,
    height: 144,
    justifyContent: 'space-between',
  },
  yLabel: {
    color: colors.textMuted,
    fontSize: 10,
  },
  chartArea: {
    flex: 1,
    position: 'relative',
    height: 162,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.cardBorder,
  },
  zeroLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.cardBorderStrong,
  },
  barRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 126,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 2,
  },
  barPressable: {
    flex: 1,
    alignItems: 'center',
  },
  barColumn: {
    width: 10,
    height: 126,
    position: 'relative',
  },
  priorTick: {
    position: 'absolute',
    left: 4,
    width: 2,
    borderRadius: 1,
    backgroundColor: colors.cardBorderStrong,
  },
  metricBar: {
    position: 'absolute',
    left: 1,
    width: 8,
    borderRadius: 4,
  },
  metricBarBase: {
    position: 'absolute',
    left: 1,
    bottom: 0,
    width: 8,
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  xAxisRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  xLabel: {
    color: colors.textMuted,
    fontSize: 10,
  },
  topCategoryBlock: {
    marginTop: 8,
    gap: 6,
  },
  topCategoryTitle: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: '700',
  },
  topCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topCategoryName: {
    color: colors.text,
    fontSize: 12,
    flex: 1,
  },
  topCategoryAmount: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  rangeDock: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    padding: 6,
  },
  rangeChip: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 8,
  },
  rangeChipActive: {
    backgroundColor: colors.primarySoft,
  },
  rangeChipLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  rangeChipLabelActive: {
    color: colors.text,
  },
  sheetGrip: {
    width: 54,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    backgroundColor: colors.cardBorderStrong,
    marginBottom: 10,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sheetValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 2,
  },
  sheetMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  sheetSection: {
    marginTop: 14,
    gap: 8,
  },
  sheetSectionTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetRowLabel: {
    color: colors.text,
    fontSize: 13,
    flex: 1,
  },
  sheetRowValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  sheetTxList: {
    maxHeight: 280,
  },
  sheetTxListContent: {
    gap: 6,
  },
  sheetTxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  sheetTxLeft: {
    flex: 1,
    marginRight: 8,
  },
  sheetTxName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  sheetTxMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  sheetTxAmount: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  sheetEmpty: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
