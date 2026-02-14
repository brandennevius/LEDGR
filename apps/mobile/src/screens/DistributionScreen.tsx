import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

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

type LayoutNode = SankeyNode & {
  _unused?: never;
};

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

type FlowPath = {
  id: string;
  sourceLabel: string;
  targetLabel: string;
  value: number;
  color: string;
  sourceColumn: number;
  targetColumn: number;
};

export function DistributionScreen() {
  const [data, setData] = useState<DistributionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const maxCategory = useMemo(() => {
    if (!data?.categories?.length) return 1;
    return Math.max(...data.categories.map((item) => item.value), 1);
  }, [data]);

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
          color: link.color,
          sourceColumn: source.column,
          targetColumn: target.column,
        };
      })
      .filter((item): item is FlowPath => Boolean(item))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const maxFlowPathValue = useMemo(
    () => Math.max(1, ...flowPaths.map((path) => path.value), 1),
    [flowPaths]
  );

  const visibleFlowPaths = useMemo(() => flowPaths.slice(0, 8), [flowPaths]);

  const stageTotals = useMemo(() => {
    const nodes = data?.nodes ?? [];
    if (!nodes.length) {
      return [];
    }

    const columns = Array.from(new Set(nodes.map((node) => node.column))).sort((a, b) => a - b);
    const totals = columns.map((column, index) => {
      const total = nodes
        .filter((node) => node.column === column)
        .reduce((sum, node) => sum + node.value, 0);

      let label = `Stage ${index + 1}`;
      if (index === 0) label = 'Sources';
      if (index === columns.length - 1) label = 'Destinations';
      if (columns.length > 2 && index > 0 && index < columns.length - 1) label = 'Allocation';

      return { label, value: total };
    });

    return totals;
  }, [data]);

  return (
    <Screen title="Distribution" subtitle="Flow of funds across this month.">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Building flow view...</Text>
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
          <Text style={styles.sectionTitle}>Flow map</Text>
          <Text style={styles.sectionSubtitle}>{data?.rangeLabel ?? 'This month'}</Text>
          <View style={styles.flowMapWrapper}>
            {visibleFlowPaths.length > 0 ? (
              <View style={styles.flowList}>
                {visibleFlowPaths.map((path) => {
                  const widthPct = Math.max(10, Math.round((path.value / maxFlowPathValue) * 100));
                  return (
                    <View key={path.id} style={styles.pathRow}>
                      <View style={styles.pathHeader}>
                        <Text style={styles.pathRoute} numberOfLines={1}>
                          {path.sourceLabel} {'->'} {path.targetLabel}
                        </Text>
                        <Text style={styles.pathAmount}>{formatCurrency(path.value)}</Text>
                      </View>
                      <View style={styles.pathBarTrack}>
                        <View
                          style={[
                            styles.pathBarFill,
                            {
                              width: `${widthPct}%`,
                              backgroundColor: path.color || colors.primary,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>Connect accounts to see your distribution flow.</Text>
            )}
          </View>
          {stageTotals.length > 0 ? (
            <View style={styles.stageTotals}>
              {stageTotals.map((stage) => (
                <View key={stage.label} style={styles.stageCard}>
                  <Text style={styles.stageLabel}>{stage.label}</Text>
                  <Text style={styles.stageValue}>{formatCurrency(stage.value)}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Flow breakdown</Text>
          <View style={styles.flowRow}>
            <View style={styles.flowItem}>
              <Text style={styles.flowLabel}>Investments</Text>
              <Text style={styles.flowValue}>{formatCurrency(data?.investmentTotal ?? 0)}</Text>
            </View>
            <View style={styles.flowItem}>
              <Text style={styles.flowLabel}>Transfers</Text>
              <Text style={styles.flowValue}>{formatCurrency(data?.transferTotal ?? 0)}</Text>
            </View>
            <View style={styles.flowItem}>
              <Text style={styles.flowLabel}>Internal</Text>
              <Text style={styles.flowValue}>{formatCurrency(data?.internalTransferTotal ?? 0)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Top destinations</Text>
          <Text style={styles.sectionSubtitle}>Largest spending categories</Text>
          {(data?.categories ?? []).length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No category data yet.</Text>
            </View>
          ) : (
            data?.categories.map((category) => {
              const percent = Math.round((category.value / maxCategory) * 100);
              return (
                <View key={category.name} style={styles.categoryRow}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryName}>{category.name}</Text>
                    <Text style={styles.categoryAmount}>{formatCurrency(category.value)}</Text>
                  </View>
                  <View style={styles.categoryBarTrack}>
                    <View style={[styles.categoryBarFill, { width: `${percent}%` }]} />
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
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
    gap: 12,
  },
  summaryCard: {
    flex: 1,
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
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  sectionCard: {
    backgroundColor: 'rgba(17, 22, 43, 0.7)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
  flowMapWrapper: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(9, 13, 27, 0.45)',
    minHeight: 120,
    padding: 12,
  },
  flowList: {
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
  },
  stageTotals: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  stageCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  stageLabel: {
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stageValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  flowRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  flowItem: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 12,
  },
  flowLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  flowValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  categoryRow: {
    marginTop: 12,
  },
  categoryHeader: {
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
    fontSize: 12,
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
  },
  emptyCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
