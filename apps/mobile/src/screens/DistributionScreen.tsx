import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { apiRequest } from '../lib/api';
import { colors } from '../theme';

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
};

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

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
          <Text style={styles.sectionTitle}>Flow breakdown</Text>
          <Text style={styles.sectionSubtitle}>{data?.rangeLabel ?? 'This month'}</Text>
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
