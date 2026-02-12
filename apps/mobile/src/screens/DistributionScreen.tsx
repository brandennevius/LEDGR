import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path, Rect, Text as SvgText } from 'react-native-svg';

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
  x: number;
  y: number;
  height: number;
};

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

const truncateLabel = (value: string, max = 16) =>
  value.length > max ? `${value.slice(0, max - 1)}...` : value;

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

  const chart = useMemo(() => {
    const nodes = data?.nodes ?? [];
    const links = data?.links ?? [];
    const width = 940;
    const height = 540;
    const nodeWidth = 18;
    const padding = 12;
    const topBottom = 20;

    if (!nodes.length) {
      return {
        width,
        height,
        nodeWidth,
        nodes: [] as LayoutNode[],
        links: [] as Array<{ id: string; path: string; thickness: number; color: string }>,
      };
    }

    const columns = Array.from(new Set(nodes.map((node) => node.column))).sort((a, b) => a - b);
    const leftMargin = 120;
    const rightMargin = 180;
    const usableWidth = Math.max(1, width - leftMargin - rightMargin);
    const gap = columns.length > 1 ? usableWidth / (columns.length - 1) : 0;
    const columnX = columns.map((_, index) => leftMargin + gap * index);

    const columnNodes = columns.map((column) => nodes.filter((node) => node.column === column));
    const columnTotals = columnNodes.map((group) => group.reduce((acc, node) => acc + node.value, 0));
    const maxColumnTotal = Math.max(1, ...columnTotals);
    const maxNodeCount = Math.max(1, ...columnNodes.map((group) => group.length));

    const scale = (height - topBottom * 2 - padding * (maxNodeCount - 1)) / maxColumnTotal;

    const layoutNodes: LayoutNode[] = [];

    columnNodes.forEach((group, columnIndex) => {
      const sorted = [...group].sort((a, b) => b.value - a.value);
      const totalHeight =
        sorted.reduce((acc, node) => acc + node.value * scale, 0) + padding * (sorted.length - 1);
      let cursor = (height - totalHeight) / 2;

      sorted.forEach((node) => {
        const nodeHeight = Math.max(4, node.value * scale);
        layoutNodes.push({
          ...node,
          x: columnX[columnIndex] ?? leftMargin,
          y: cursor,
          height: nodeHeight,
        });
        cursor += nodeHeight + padding;
      });
    });

    const nodeMap = new Map(layoutNodes.map((node) => [node.id, node]));
    const outgoing = new Map<string, number>();
    const incoming = new Map<string, number>();

    const layoutLinks = links
      .map((link) => {
        const source = nodeMap.get(link.source);
        const target = nodeMap.get(link.target);
        if (!source || !target) {
          return null;
        }

        const thickness = Math.max(1, link.value * scale);
        const sourceOffset = outgoing.get(source.id) ?? 0;
        const targetOffset = incoming.get(target.id) ?? 0;

        const sourceY = source.y + sourceOffset + thickness / 2;
        const targetY = target.y + targetOffset + thickness / 2;

        outgoing.set(source.id, sourceOffset + thickness);
        incoming.set(target.id, targetOffset + thickness);

        const startX = source.x + nodeWidth;
        const endX = target.x;
        const dx = (endX - startX) * 0.45;
        const path = `M ${startX} ${sourceY} C ${startX + dx} ${sourceY}, ${endX - dx} ${targetY}, ${endX} ${targetY}`;

        return {
          id: `${link.source}-${link.target}`,
          path,
          thickness,
          color: link.color,
        };
      })
      .filter((item): item is { id: string; path: string; thickness: number; color: string } =>
        Boolean(item)
      );

    return {
      width,
      height,
      nodeWidth,
      nodes: layoutNodes,
      links: layoutLinks,
    };
  }, [data]);

  const hasChartData = chart.nodes.length > 0;

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
          <View style={styles.chartWrapper}>
            {hasChartData ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Svg width={chart.width} height={chart.height}>
                  {chart.links.map((link) => (
                    <Path
                      key={link.id}
                      d={link.path}
                      fill="none"
                      stroke={link.color}
                      strokeWidth={Math.max(1.5, link.thickness)}
                      strokeLinecap="round"
                      opacity={0.7}
                    />
                  ))}
                  {chart.nodes.map((node) => (
                    <G key={node.id}>
                      <Rect
                        x={node.x}
                        y={node.y}
                        width={chart.nodeWidth}
                        height={node.height}
                        rx={5}
                        fill={node.color}
                      />
                      <SvgText
                        x={node.x + chart.nodeWidth + 6}
                        y={node.y + 12}
                        fill={colors.text}
                        fontSize={10}
                        fontWeight="600"
                      >
                        {truncateLabel(node.label)}
                      </SvgText>
                    </G>
                  ))}
                </Svg>
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>Connect accounts to see your distribution flow.</Text>
            )}
          </View>
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
  chartWrapper: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(9, 13, 27, 0.45)',
    overflow: 'hidden',
    minHeight: 320,
    paddingVertical: 8,
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
