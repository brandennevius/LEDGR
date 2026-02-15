import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Chip from '../components/Chip';
import ModalSheet from '../components/ModalSheet';
import { Screen } from '../components/Screen';
import { apiRequest } from '../lib/api';
import { colors } from '../theme';

type TransactionRow = {
  id: string;
  baseId?: string;
  name: string;
  category: string;
  amount: number;
  isIncome: boolean;
  needsReview?: boolean;
  hasSplits?: boolean;
  date: string;
};

type TransactionDetail = {
  id: string;
  name: string;
  amount: number;
  category: string;
  transactionType?: 'INCOME' | 'INTERNAL_TRANSFER' | 'REGULAR';
  date: string;
  needsReview?: boolean;
  hasSplits?: boolean;
  splits?: Array<{ id?: string; category: string; amount: number; note?: string | null }>;
  account?: {
    name?: string;
    institutionName?: string;
    mask?: string;
    type?: string;
  };
};

type TransactionsResponse = {
  transactions: TransactionRow[];
};

type CategoriesResponse = {
  categories: string[];
};

type SplitDraft = {
  category: string;
  amount: string;
  note?: string;
};

const dayOptions = [
  { label: '7d', value: 7 },
  { label: '14d', value: 14 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

export function TransactionsScreen() {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [categoryList, setCategoryList] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  const [selected, setSelected] = useState<TransactionDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');
  const [transactionTypeInput, setTransactionTypeInput] = useState<'INCOME' | 'INTERNAL_TRANSFER' | 'REGULAR'>('REGULAR');
  const [applyToSimilar, setApplyToSimilar] = useState(false);
  const [applyToCategory, setApplyToCategory] = useState(false);
  const [createRule, setCreateRule] = useState(false);
  const [ruleMatchType, setRuleMatchType] = useState<'EXACT' | 'PARTIAL'>('EXACT');
  const [ruleMatchValue, setRuleMatchValue] = useState('');
  const [splits, setSplits] = useState<SplitDraft[]>([]);
  const [savingSplits, setSavingSplits] = useState(false);
  const [savingDetail, setSavingDetail] = useState(false);

  const fetchRows = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('days', String(days));
      if (categoryFilter !== 'All') params.set('category', categoryFilter);
      if (needsReviewOnly) params.set('needsReview', 'true');
      const data = await apiRequest<TransactionsResponse>(`/api/transactions?${params.toString()}`);
      setTransactions(data.transactions ?? []);
      setError(null);
    } catch (err) {
      const message =
        typeof err === 'object' && err && 'error' in err
          ? String((err as { error?: string }).error)
          : 'Unable to load transactions.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await apiRequest<CategoriesResponse>('/api/categories');
      setCategoryList(['All', ...(data.categories ?? [])]);
    } catch {
      setCategoryList(['All']);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [days, categoryFilter, needsReviewOnly]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const filteredRows = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return transactions;
    return transactions.filter(
      (row) =>
        row.name.toLowerCase().includes(trimmed) ||
        row.category.toLowerCase().includes(trimmed)
    );
  }, [query, transactions]);

  const stats = useMemo(() => {
    const income = transactions
      .filter((tx) => tx.isIncome)
      .reduce((acc, tx) => acc + tx.amount, 0);
    const spend = transactions
      .filter((tx) => !tx.isIncome)
      .reduce((acc, tx) => acc + tx.amount, 0);
    return { income, spend };
  }, [transactions]);

  const reviewCount = useMemo(
    () => transactions.filter((tx) => tx.needsReview).length,
    [transactions]
  );

  const hasActiveFilters = categoryFilter !== 'All' || needsReviewOnly || days !== 30 || query.trim().length > 0;

  const openDetail = async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const detail = await apiRequest<TransactionDetail>(`/api/transactions/${id}`);
      setSelected(detail);
      setCategoryInput(detail.category ?? '');
      setTransactionTypeInput(detail.transactionType ?? 'REGULAR');
      setSplits(
        (detail.splits ?? []).map((split) => ({
          category: split.category,
          amount: String(split.amount),
          note: split.note ?? '',
        }))
      );
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
      await fetchRows();
      setDetailOpen(false);
    } finally {
      setSavingDetail(false);
    }
  };

  const saveSplits = async () => {
    if (!selected) return;
    setSavingSplits(true);
    try {
      await apiRequest(`/api/transactions/${selected.id}/splits`, {
        method: 'PUT',
        body: {
          splits: splits
            .map((split) => ({
              category: split.category,
              amount: Number(split.amount),
              note: split.note?.trim() || null,
            }))
            .filter((split) => split.category && split.amount > 0),
        },
      });
      await fetchRows();
      setDetailOpen(false);
    } finally {
      setSavingSplits(false);
    }
  };

  const markReviewed = async () => {
    if (!selected) return;
    await apiRequest('/api/transactions/review', {
      method: 'POST',
      body: { id: selected.id, category: categoryInput || selected.category },
    });
    await fetchRows();
    setDetailOpen(false);
  };

  return (
    <Screen title="Transactions" subtitle="Review, filter, and recategorize.">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchRows();
            }}
            tintColor={colors.text}
          />
        }
      >
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Spend ({days}d)</Text>
            <Text style={styles.summaryValue}>{formatCurrency(stats.spend)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Income ({days}d)</Text>
            <Text style={styles.summaryValue}>{formatCurrency(stats.income)}</Text>
          </View>
        </View>

        <View style={styles.filtersCard}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search transactions"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />

          <View style={styles.filterHeaderRow}>
            <Text style={styles.filterSectionTitle}>Date range</Text>
            {days !== 30 ? <Text style={styles.filterHint}>{days} days</Text> : null}
          </View>
          <View style={styles.filterRow}>
            {dayOptions.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                active={days === option.value}
                onPress={() => setDays(option.value)}
              />
            ))}
          </View>

          <View style={styles.filterHeaderRow}>
            <Text style={styles.filterSectionTitle}>Category</Text>
            {categoryFilter !== 'All' ? <Text style={styles.filterHint}>{categoryFilter}</Text> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {(categoryList.length ? categoryList : ['All']).map((name) => (
              <View key={name}>
                <Chip label={name} active={categoryFilter === name} onPress={() => setCategoryFilter(name)} />
              </View>
            ))}
          </ScrollView>

          <View style={styles.filterHeaderRow}>
            <Text style={styles.filterSectionTitle}>Review status</Text>
            <Text style={styles.filterHint}>{reviewCount} flagged</Text>
          </View>
          <View style={styles.filterRow}>
            <Chip
              label={needsReviewOnly ? 'Needs review' : 'All reviews'}
              active={needsReviewOnly}
              onPress={() => setNeedsReviewOnly((prev) => !prev)}
            />
            {hasActiveFilters ? (
              <Pressable
                onPress={() => {
                  setQuery('');
                  setDays(30);
                  setCategoryFilter('All');
                  setNeedsReviewOnly(false);
                }}
                style={styles.clearButton}
              >
                <Text style={styles.clearButtonLabel}>Clear filters</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Syncing transactions...</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {filteredRows.length === 0 && !loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptyBody}>Connect a bank account to start syncing.</Text>
          </View>
        ) : null}

        {filteredRows.map((item) => (
          <Pressable key={item.id} onPress={() => openDetail(item.baseId ?? item.id)}>
            <View style={styles.row}>
              <View style={styles.meta}>
                <Text style={styles.merchant}>{item.name}</Text>
                <Text style={styles.category}>
                  {item.category} · {item.date}
                  {item.needsReview ? ' · Review' : ''}
                  {item.hasSplits ? ' · Split' : ''}
                </Text>
              </View>
              <Text style={[styles.amount, item.isIncome ? styles.positive : styles.negative]}>
                {item.isIncome ? '+' : '-'}
                {formatCurrency(item.amount)}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <ModalSheet visible={detailOpen} onClose={() => setDetailOpen(false)}>
        {detailLoading || !selected ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading details...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.detailContent}>
            <Text style={styles.detailTitle}>{selected.name}</Text>
            <Text style={styles.detailSubtitle}>
              {selected.account?.institutionName ?? 'Account'} · {selected.date}
            </Text>
            <Text style={styles.detailAmount}>
              {selected.amount < 0 ? '+' : '-'} {formatCurrency(Math.abs(selected.amount))}
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

            <View style={styles.toggleRow}>
              <Pressable onPress={() => setApplyToSimilar((prev) => !prev)} style={styles.toggleButton}>
                <Text style={styles.toggleLabel}>
                  {applyToSimilar ? 'Apply to similar ✓' : 'Apply to similar'}
                </Text>
              </Pressable>
              <Pressable onPress={() => setApplyToCategory((prev) => !prev)} style={styles.toggleButton}>
                <Text style={styles.toggleLabel}>
                  {applyToCategory ? 'Apply to category ✓' : 'Apply to category'}
                </Text>
              </Pressable>
            </View>

            <Pressable onPress={() => setCreateRule((prev) => !prev)} style={styles.toggleButton}>
              <Text style={styles.toggleLabel}>
                {createRule ? 'Create rule ✓' : 'Create rule'}
              </Text>
            </Pressable>
            {createRule ? (
              <View style={styles.ruleBox}>
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
                  placeholder="Match text"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                />
              </View>
            ) : null}

            {selected.needsReview ? (
              <Pressable style={styles.secondaryButton} onPress={markReviewed}>
                <Text style={styles.secondaryLabel}>Mark reviewed</Text>
              </Pressable>
            ) : null}

            <Pressable style={styles.primaryButton} onPress={saveDetail} disabled={savingDetail}>
              <Text style={styles.primaryLabel}>{savingDetail ? 'Saving...' : 'Save changes'}</Text>
            </Pressable>

            <Text style={styles.detailSectionTitle}>Splits</Text>
            {splits.length === 0 ? (
              <Text style={styles.emptyText}>No splits yet.</Text>
            ) : null}
            {splits.map((split, index) => (
              <View key={`${split.category}-${index}`} style={styles.splitRow}>
                <TextInput
                  value={split.category}
                  onChangeText={(value) => {
                    setSplits((prev) =>
                      prev.map((item, idx) => (idx === index ? { ...item, category: value } : item))
                    );
                  }}
                  placeholder="Category"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, styles.splitInput]}
                />
                <TextInput
                  value={split.amount}
                  onChangeText={(value) => {
                    setSplits((prev) =>
                      prev.map((item, idx) => (idx === index ? { ...item, amount: value } : item))
                    );
                  }}
                  placeholder="Amount"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={[styles.input, styles.splitInput]}
                />
              </View>
            ))}
            <Pressable
              style={styles.secondaryButton}
              onPress={() => setSplits((prev) => [...prev, { category: '', amount: '' }])}
            >
              <Text style={styles.secondaryLabel}>Add split</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={saveSplits} disabled={savingSplits}>
              <Text style={styles.primaryLabel}>{savingSplits ? 'Saving...' : 'Save splits'}</Text>
            </Pressable>
          </ScrollView>
        )}
      </ModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 24,
    gap: 12,
  },
  summaryRow: {
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
  filtersCard: {
    backgroundColor: 'rgba(17, 22, 43, 0.7)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 10,
  },
  searchInput: {
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
  filterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterSectionTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  filterHint: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  categoryScroll: {
    gap: 8,
    paddingRight: 6,
  },
  clearButton: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  clearButtonLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  emptyCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(18, 24, 46, 0.7)',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  row: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 20, 40, 0.6)',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meta: {
    flex: 1,
    marginRight: 12,
  },
  merchant: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  category: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
  },
  positive: {
    color: colors.success,
  },
  negative: {
    color: colors.danger,
  },
  detailContent: {
    gap: 12,
  },
  detailTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  detailSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
  },
  detailAmount: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
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
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggleButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toggleLabel: {
    color: colors.text,
    fontSize: 12,
  },
  ruleBox: {
    gap: 8,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryLabel: {
    color: colors.background,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  secondaryLabel: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 12,
  },
  splitRow: {
    flexDirection: 'row',
    gap: 8,
  },
  splitInput: {
    flex: 1,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
