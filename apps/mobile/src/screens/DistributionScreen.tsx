import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { Screen } from '../components/Screen';
import { apiRequest } from '../lib/api';
import { colors } from '../theme';

type SankeyNode = {
  id: string;
  label: string;
  value: number;
  column: number;
  color: string;
};

type SankeyLink = {
  source: string;
  target: string;
  value: number;
  color: string;
};

type DistributionResponse = {
  clientName: string;
  rangeLabel: string;
  inflowTotal: number;
  inflowLabel: string;
  spendTotal: number;
  investmentTotal: number;
  transferTotal: number;
  internalTransferTotal: number;
  savings: number;
  categories: Array<{ name: string; value: number }>;
  nodes: SankeyNode[];
  links: SankeyLink[];
};

type AllocationBucket = {
  id: 'spend' | 'savings' | 'investments' | 'transfers' | 'internal' | 'unallocated';
  label: string;
  value: number;
  color: string;
};

type FlowPath = {
  id: string;
  sourceLabel: string;
  targetLabel: string;
  value: number;
};

const BUCKET_COLORS: Record<AllocationBucket['id'], string> = {
  spend: '#22D3EE',
  savings: '#34D399',
  investments: '#F59E0B',
  transfers: '#A78BFA',
  internal: '#60A5FA',
  unallocated: '#F87171',
};

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

const formatPct = (value: number) => `${Math.round(value)}%`;

export function DistributionScreen() {
  const [data, setData] = useState<DistributionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flowLimit, setFlowLimit] = useState<5 | 8>(5);
  const { width } = useWindowDimensions();
  const isCompact = width < 390;

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
              : 'Unable to load distribution.';
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

  const totals = useMemo(() => {
    if (!data) {
      return [
        { label: 'Income', value: 0 },
        { label: 'Spend', value: 0 },
        { label: 'Savings', value: 0 },
      ];
    }
    return [
      { label: data.inflowLabel, value: data.inflowTotal },
      { label: 'Spend', value: data.spendTotal },
      { label: 'Savings', value: data.savings },
    ];
  }, [data]);

  const allocation = useMemo(() => {
    const inflowTotal = Math.max(0, data?.inflowTotal ?? 0);
    const spend = Math.max(0, data?.spendTotal ?? 0);
    const savings = Math.max(0, data?.savings ?? 0);
    const investments = Math.max(0, data?.investmentTotal ?? 0);
    const transfers = Math.max(0, data?.transferTotal ?? 0);
    const internal = Math.max(0, data?.internalTransferTotal ?? 0);

    const allocated = spend + savings + investments + transfers + internal;
    const unallocated = Math.max(0, inflowTotal - allocated);

    const buckets: AllocationBucket[] = (
      [
        { id: 'spend', label: 'Spend', value: spend, color: BUCKET_COLORS.spend },
        { id: 'savings', label: 'Savings', value: savings, color: BUCKET_COLORS.savings },
        { id: 'investments', label: 'Investments', value: investments, color: BUCKET_COLORS.investments },
        { id: 'transfers', label: 'Transfers', value: transfers, color: BUCKET_COLORS.transfers },
        { id: 'internal', label: 'Internal', value: internal, color: BUCKET_COLORS.internal },
        { id: 'unallocated', label: 'Unallocated', value: unallocated, color: BUCKET_COLORS.unallocated },
      ] as AllocationBucket[]
    ).filter((bucket) => bucket.value > 0);

    return {
      inflowTotal,
      buckets,
    };
  }, [data]);

  const [selectedBucket, setSelectedBucket] = useState<AllocationBucket['id']>('spend');

  useEffect(() => {
    if (!allocation.buckets.length) {
      return;
    }
    if (!allocation.buckets.some((bucket) => bucket.id === selectedBucket)) {
      setSelectedBucket(allocation.buckets[0].id);
    }
  }, [allocation.buckets, selectedBucket]);

  const selectedBucketData = useMemo(
    () => allocation.buckets.find((bucket) => bucket.id === selectedBucket) ?? null,
    [allocation.buckets, selectedBucket]
  );

  const selectedBreakdown = useMemo(() => {
    if (!selectedBucketData) return [];

    if (selectedBucketData.id === 'spend') {
      return [...(data?.categories ?? [])]
        .sort((a, b) => b.value - a.value)
        .slice(0, 6)
        .map((item) => ({ label: item.name, value: item.value }));
    }

    return [
      {
        label: selectedBucketData.label,
        value: selectedBucketData.value,
      },
    ];
  }, [data?.categories, selectedBucketData]);

  const flowPaths = useMemo<FlowPath[]>(() => {
    const nodes = data?.nodes ?? [];
    const links = data?.links ?? [];
    if (!nodes.length || !links.length) {
      return [];
    }

    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    return links
      .map((link) => {
        const source = nodeMap.get(link.source);
        const target = nodeMap.get(link.target);
        if (!source || !target) return null;
        return {
          id: `${link.source}-${link.target}`,
          sourceLabel: source.label,
          targetLabel: target.label,
          value: link.value,
        };
      })
      .filter((item): item is FlowPath => Boolean(item))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const visibleFlowPaths = useMemo(() => flowPaths.slice(0, flowLimit), [flowLimit, flowPaths]);

  const maxFlowPathValue = useMemo(
    () => Math.max(1, ...visibleFlowPaths.map((path) => path.value), 1),
    [visibleFlowPaths]
  );

  const maxBreakdown = useMemo(
    () => Math.max(1, ...selectedBreakdown.map((item) => item.value), 1),
    [selectedBreakdown]
  );

  return (
    <Screen title="Distribution" subtitle="Where each paycheck dollar is allocated." edgeToEdge>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading allocation graph...</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.summaryGrid}>
          {totals.map((item) => (
            <View key={item.label} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryValue}>{formatCurrency(item.value)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, isCompact && styles.sectionTitleCompact]}>Paycheck allocation</Text>
          <Text style={[styles.sectionSubtitle, isCompact && styles.sectionSubtitleCompact]}>
            {data?.rangeLabel ?? 'This month'} • mirrors web distribution totals
          </Text>

          {allocation.buckets.length > 0 ? (
            <>
              <View style={styles.allocationTrack}>
                {allocation.buckets.map((bucket) => {
                  const pct = allocation.inflowTotal > 0 ? (bucket.value / allocation.inflowTotal) * 100 : 0;
                  return (
                    <View
                      key={bucket.id}
                      style={[
                        styles.allocationSegment,
                        {
                          flexGrow: Math.max(1, bucket.value),
                          backgroundColor: bucket.color,
                          opacity: selectedBucket === bucket.id ? 1 : 0.7,
                        },
                      ]}
                    />
                  );
                })}
              </View>

              <View style={styles.bucketLegend}>
                {allocation.buckets.map((bucket) => {
                  const pct = allocation.inflowTotal > 0 ? (bucket.value / allocation.inflowTotal) * 100 : 0;
                  const active = selectedBucket === bucket.id;
                  return (
                    <Pressable
                      key={bucket.id}
                      onPress={() => setSelectedBucket(bucket.id)}
                      style={[styles.bucketCard, active && styles.bucketCardActive]}
                    >
                      <View style={styles.bucketHeader}>
                        <View style={[styles.bucketDot, { backgroundColor: bucket.color }]} />
                        <Text style={styles.bucketLabel}>{bucket.label}</Text>
                        <Text style={styles.bucketPct}>{formatPct(pct)}</Text>
                      </View>
                      <Text style={styles.bucketAmount}>{formatCurrency(bucket.value)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No income data found for this month.</Text>
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Selected bucket breakdown</Text>
          <Text style={styles.sectionSubtitle}>{selectedBucketData?.label ?? 'Choose a bucket above'}</Text>

          {selectedBreakdown.length > 0 ? (
            selectedBreakdown.map((item) => {
              const pct = selectedBucketData ? (item.value / Math.max(1, selectedBucketData.value)) * 100 : 0;
              const widthPct = Math.max(6, Math.round((item.value / maxBreakdown) * 100));
              return (
                <View key={item.label} style={styles.breakdownRow}>
                  <View style={styles.breakdownHeader}>
                    <Text style={styles.breakdownName} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text style={styles.breakdownAmount}>{formatCurrency(item.value)}</Text>
                  </View>
                  <View style={styles.breakdownBarTrack}>
                    <View style={[styles.breakdownBarFill, { width: `${widthPct}%` }]} />
                  </View>
                  <Text style={styles.breakdownMeta}>{formatPct(pct)} of {selectedBucketData?.label ?? 'bucket'}</Text>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No detail breakdown for this bucket yet.</Text>
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.flowHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Top money paths</Text>
              <Text style={styles.sectionSubtitle}>Income source {'->'} destination</Text>
            </View>
            {flowPaths.length > 5 ? (
              <View style={styles.toggleRow}>
                <Pressable
                  onPress={() => setFlowLimit(5)}
                  style={[styles.toggleButton, flowLimit === 5 && styles.toggleButtonActive]}
                >
                  <Text style={[styles.toggleLabel, flowLimit === 5 && styles.toggleLabelActive]}>Top 5</Text>
                </Pressable>
                <Pressable
                  onPress={() => setFlowLimit(8)}
                  style={[styles.toggleButton, flowLimit === 8 && styles.toggleButtonActive]}
                >
                  <Text style={[styles.toggleLabel, flowLimit === 8 && styles.toggleLabelActive]}>Top 8</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {visibleFlowPaths.length > 0 ? (
            <View style={styles.flowList}>
              {visibleFlowPaths.map((path) => {
                const widthPct = Math.max(10, Math.round((path.value / maxFlowPathValue) * 100));
                const incomePct = allocation.inflowTotal > 0 ? (path.value / allocation.inflowTotal) * 100 : 0;

                return (
                  <View key={path.id} style={styles.pathRow}>
                    <View style={styles.pathHeader}>
                      <Text style={styles.pathRoute} numberOfLines={1}>
                        {path.sourceLabel} {'->'} {path.targetLabel}
                      </Text>
                      <Text style={styles.pathAmount}>{formatCurrency(path.value)}</Text>
                    </View>
                    <View style={styles.pathBarTrack}>
                      <View style={[styles.pathBarFill, { width: `${widthPct}%` }]} />
                    </View>
                    <Text style={styles.pathMeta}>{formatPct(incomePct)} of paycheck</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Connect accounts to view flow paths.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
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
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  sectionCard: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionTitleCompact: {
    fontSize: 15,
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  sectionSubtitleCompact: {
    fontSize: 11,
  },
  allocationTrack: {
    marginTop: 12,
    flexDirection: 'row',
    height: 18,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  allocationSegment: {
    height: '100%',
  },
  bucketLegend: {
    marginTop: 12,
    gap: 8,
  },
  bucketCard: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  bucketCardActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: colors.primary,
  },
  bucketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bucketDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  bucketLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  bucketPct: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  bucketAmount: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  breakdownRow: {
    marginTop: 12,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  breakdownName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  breakdownAmount: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  breakdownBarTrack: {
    marginTop: 6,
    height: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  breakdownMeta: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 11,
  },
  flowHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 6,
  },
  toggleButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderColor: colors.primary,
  },
  toggleLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  toggleLabelActive: {
    color: colors.text,
  },
  flowList: {
    marginTop: 12,
    gap: 12,
  },
  pathRow: {
    gap: 7,
  },
  pathHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  pathRoute: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  pathAmount: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  pathBarTrack: {
    height: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  pathBarFill: {
    height: '100%',
    borderRadius: 6,
    minWidth: 8,
    backgroundColor: colors.primary,
  },
  pathMeta: {
    color: colors.textMuted,
    fontSize: 11,
  },
  emptyCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
