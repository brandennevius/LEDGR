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
import SectionCard from '../components/SectionCard';
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
  source?: string;
  hasSplits?: boolean;
  date: string;
  transactionType?: 'INCOME' | 'INTERNAL_TRANSFER' | 'REGULAR';
};

type SplitRow = {
  id?: string;
  category: string;
  amount: number;
  note?: string | null;
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
  splits?: SplitRow[];
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
  categories?: string[];
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
    maximumFractionDigits: 2,
  });

const buildQuery = (days: number, category: string, needsReview: boolean) => {
  const params = new URLSearchParams();
  params.set('days', String(days));
  if (category !== 'All') params.set('category', category);
  if (needsReview) params.set('needsReview', 'true');
  return params.toString();
};

const buildRulePreview = (rows: TransactionRow[], matchType: 'EXACT' | 'PARTIAL', value: string) => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return [];
  return rows.filter((row) => {
    const name = row.name.toLowerCase();
    if (matchType === 'EXACT') {
      return name === trimmed;
    }
    return name.includes(trimmed);
  });
};

const normalizeSplit = (split: SplitRow) => ({
  category: split.category.trim(),
  amount: Number(split.amount) || 0,
  note: split.note?.trim() || null,
});

export function TransactionsScreen() {
  const [days, setDays] = useState(30);
  const [category, setCategory] = useState('All');
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<string[]>([]);
  const [selected, setSelected] = useState<TransactionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');
  const [transactionTypeInput, setTransactionTypeInput] = useState<
    'INCOME' | 'INTERNAL_TRANSFER' | 'REGULAR'
  >('REGULAR');
  const [applyToSimilar, setApplyToSimilar] = useState(false);
  const [applyToCategory, setApplyToCategory] = useState(false);
  const [createRule, setCreateRule] = useState(false);
  const [ruleMatchType, setRuleMatchType] = useState<'EXACT' | 'PARTIAL'>('EXACT');
  const [ruleMatchValue, setRuleMatchValue] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);

  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [splitSaving, setSplitSaving] = useState(false);

  const loadCategories = async () => {
    try {
      const data = await apiRequest<CategoriesResponse>('/api/categories');
      const list = Array.isArray(data.categories) ? data.categories : [];
      setCategories(['All', ...list.filter((item) => item !== 'All')]);
    } catch {
      setCategories(['All']);
    }
  };

  const loadTransactions = async () => {
    try {
      const queryString = buildQuery(days, category, needsReviewOnly);
      const data = await apiRequest<TransactionsResponse>(`/api/transactions?${queryString}`);
      setRows(data.transactions ?? []);
      setError(null);
    } catch (err) {
      const message =
        typeof err === 'object' && err && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Unable to load transactions.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCategories().catch(() => null);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadTransactions();
  }, [days, category, needsReviewOnly]);

  const filteredRows = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return rows;
    return rows.filter(
      (row) => row.name.toLowerCase().includes(trimmed) || row.category.toLowerCase().includes(trimmed)
    );
  }, [rows, query]);

  const summary = useMemo(() => {
    const income = rows.filter((row) => row.isIncome).reduce((acc, row) => acc + row.amount, 0);
    const spend = rows.filter((row) => !row.isIncome).reduce((acc, row) => acc + row.amount, 0);
    const review = rows.filter((row) => row.needsReview).length;
    return { income, spend, review };
  }, [rows]);

  const similarRows = useMemo(() => {
    if (!selected) return [];
    return rows.filter((row) => row.name === selected.name && row.id !== selected.id).slice(0, 6);
  }, [rows, selected]);

  const similarCount = useMemo(() => {
    if (!selected) return 0;
    return rows.filter((row) => row.name === selected.name).length;
  }, [rows, selected]);

  const rulePreview = useMemo(
    () => buildRulePreview(rows, ruleMatchType, ruleMatchValue).slice(0, 6),
    [rows, ruleMatchType, ruleMatchValue]
  );

  const splitTotal = useMemo(
    () => splits.reduce((acc, split) => acc + (Number(split.amount) || 0), 0),
    [splits]
  );

  const remainingSplit = useMemo(() => {
    if (!selected) return 0;
    return Math.max(0, Math.abs(selected.amount) - splitTotal);
  }, [selected, splitTotal]);

  const canSaveSplits = useMemo(() => {
    if (!selected) return false;
    if (splits.length === 0) return false;
    if (splitTotal <= 0) return false;
    return splitTotal <= Math.abs(selected.amount) + 0.01;
  }, [selected, splits, splitTotal]);

  const openDetail = async (row: TransactionRow) => {
    setDetailLoading(true);
    setSelected(null);
    try {
      const targetId = row.baseId ?? row.id;
      const data = await apiRequest<TransactionDetail>(`/api/transactions/${targetId}`);
      setSelected(data);
      setCategoryInput(data.category ?? '');
      setTransactionTypeInput(data.transactionType ?? 'REGULAR');
      setRuleMatchValue(data.name ?? '');
      setSplits(
        (data.splits ?? []).map((split) => ({
          id: split.id,
          category: split.category,
          amount: split.amount,
          note: split.note ?? '',
        }))
      );
      setApplyToSimilar(false);
      setApplyToCategory(false);
      setCreateRule(false);
      setRuleMatchType('EXACT');
    } catch (err) {
      const message =
        typeof err === 'object' && err && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Unable to load transaction.';
      setError(message);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
  };

  const saveDetail = async () => {
    if (!selected) return;
    const payload = {
      category: categoryInput,
      transactionType: transactionTypeInput,
      applyToSimilar,
      applyToCategory,
      createRule,
      ruleMatchType,
      ruleMatchValue,
    };

    setSavingDetail(true);
    try {
      await apiRequest(`/api/transactions/${selected.id}`, {
        method: 'PATCH',
        body: payload,
      });
      await loadTransactions();
      await openDetail({ id: selected.id, name: selected.name, category: selected.category, amount: selected.amount, isIncome: selected.amount < 0, date: selected.date });
    } catch (err) {
      const message =
        typeof err === 'object' && err && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Unable to save transaction.';
      setError(message);
    } finally {
      setSavingDetail(false);
    }
  };

  const saveSplits = async () => {
    if (!selected) return;
    setSplitSaving(true);
    try {
      await apiRequest(`/api/transactions/${selected.id}/splits`, {
        method: 'PUT',
        body: {
          splits: splits.map(normalizeSplit).filter((split) => split.category && split.amount > 0),
        },
      });
      await loadTransactions();
      await openDetail({ id: selected.id, name: selected.name, category: selected.category, amount: selected.amount, isIncome: selected.amount < 0, date: selected.date });
    } catch (err) {
      const message =
        typeof err === 'object' && err && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Unable to save splits.';
      setError(message);
    } finally {
      setSplitSaving(false);
    }
  };

  const addSplit = () => {
    setSplits((prev) => [
      ...prev,
      { id: `draft-${Date.now()}`, category: categoryInput || 'Uncategorized', amount: 0, note: '' },
    ]);
  };

  const updateSplit = (index: number, key: keyof SplitRow, value: string) => {
    setSplits((prev) =>
      prev.map((split, idx) => {
        if (idx !== index) return split;
        if (key === 'amount') {
          const amount = Number.parseFloat(value.replace(/[^0-9.]/g, ''));
          return { ...split, amount: Number.isNaN(amount) ? 0 : amount };
        }
        return { ...split, [key]: value };
      })
    );
  };

  const removeSplit = (index: number) => {
    setSplits((prev) => prev.filter((_, idx) => idx !== index));
  };

  return (
    <Screen title="Transactions" subtitle="Review, categorize, and split activity.">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadTransactions();
            }}
            tintColor={colors.text}
          />
        }
      >
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Spend</Text>
            <Text style={styles.summaryValue}>{formatCurrency(summary.spend)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Income</Text>
            <Text style={styles.summaryValue}>{formatCurrency(summary.income)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Needs review</Text>
            <Text style={styles.summaryValue}>{summary.review}</Text>
          </View>
        </View>

        <View style={styles.searchCard}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search merchants or categories"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {dayOptions.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              active={days === option.value}
              onPress={() => setDays(option.value)}
            />
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {categories.map((item) => (
            <Chip
              key={item}
              label={item}
              active={category === item}
              onPress={() => setCategory(item)}
            />
          ))}
        </ScrollView>

        <View style={styles.filterRow}>
          <Chip
            label="Needs review"
            active={needsReviewOnly}
            onPress={() => setNeedsReviewOnly((prev) => !prev)}
          />
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
            <Text style={styles.emptyTitle}>No transactions found</Text>
            <Text style={styles.emptyBody}>Try a different filter or search term.</Text>
          </View>
        ) : null}

        {filteredRows.map((item) => (
          <Pressable key={item.id} style={styles.row} onPress={() => openDetail(item)}>
            <View style={styles.rowMeta}>
              <Text style={styles.merchant}>{item.name}</Text>
              <Text style={styles.category}>
                {item.category} · {item.date}
              </Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.amount, item.isIncome ? styles.amountPositive : styles.amountNegative]}>
                {formatCurrency(item.amount)}
              </Text>
              <View style={styles.tagRow}>
                {item.needsReview ? <Text style={styles.tagWarning}>Review</Text> : null}
                {item.hasSplits ? <Text style={styles.tagInfo}>Split</Text> : null}
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <ModalSheet visible={Boolean(selected) || detailLoading} onClose={closeDetail}>
        {detailLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading details...</Text>
          </View>
        ) : null}
        {selected ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{selected.name}</Text>
              <Text style={styles.sheetAmount}>{formatCurrency(Math.abs(selected.amount))}</Text>
              <Text style={styles.sheetMeta}>{selected.date}</Text>
            </View>

            <SectionCard title="Account">
              <Text style={styles.detailValue}>
                {selected.account?.institutionName
                  ? `${selected.account.institutionName} • ${selected.account.mask ?? ''}`
                  : selected.account?.name ?? 'Account details unavailable'}
              </Text>
            </SectionCard>

            <SectionCard title="Category + rules">
              <TextInput
                style={styles.input}
                placeholder="Category"
                placeholderTextColor={colors.textMuted}
                value={categoryInput}
                onChangeText={setCategoryInput}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                {categories
                  .filter((item) => item !== 'All')
                  .slice(0, 12)
                  .map((item) => (
                    <Chip
                      key={item}
                      label={item}
                      active={categoryInput === item}
                      onPress={() => setCategoryInput(item)}
                    />
                  ))}
              </ScrollView>

              <View style={styles.toggleRow}>
                <Chip
                  label="Apply to similar"
                  active={applyToSimilar}
                  onPress={() => {
                    setApplyToSimilar((prev) => !prev);
                    if (!applyToSimilar) setApplyToCategory(false);
                  }}
                />
                <Chip
                  label="Apply to category"
                  active={applyToCategory}
                  onPress={() => {
                    setApplyToCategory((prev) => !prev);
                    if (!applyToCategory) setApplyToSimilar(false);
                  }}
                />
              </View>

              <View style={styles.toggleRow}>
                <Chip
                  label="Create rule"
                  active={createRule}
                  onPress={() => setCreateRule((prev) => !prev)}
                />
                <Chip
                  label={`Match ${ruleMatchType === 'EXACT' ? 'exact' : 'partial'}`}
                  active={ruleMatchType === 'PARTIAL'}
                  onPress={() =>
                    setRuleMatchType((prev) => (prev === 'EXACT' ? 'PARTIAL' : 'EXACT'))
                  }
                />
              </View>

              {createRule ? (
                <TextInput
                  style={styles.input}
                  placeholder="Rule match value"
                  placeholderTextColor={colors.textMuted}
                  value={ruleMatchValue}
                  onChangeText={setRuleMatchValue}
                />
              ) : null}
            </SectionCard>

            <SectionCard title="Transaction type">
              <View style={styles.toggleRow}>
                {['REGULAR', 'INCOME', 'INTERNAL_TRANSFER'].map((value) => (
                  <Chip
                    key={value}
                    label={
                      value === 'INTERNAL_TRANSFER'
                        ? 'Transfer'
                        : value === 'REGULAR'
                        ? 'Regular'
                        : 'Income'
                    }
                    active={transactionTypeInput === value}
                    onPress={() =>
                      setTransactionTypeInput(value as 'INCOME' | 'INTERNAL_TRANSFER' | 'REGULAR')
                    }
                  />
                ))}
              </View>
            </SectionCard>

            <SectionCard
              title="Similar transactions"
              subtitle={
                similarCount > 1
                  ? `${similarCount - 1} similar transactions`
                  : 'No similar transactions'
              }
            >
              {similarRows.length > 0 ? (
                similarRows.map((item) => (
                  <View key={item.id} style={styles.similarRow}>
                    <Text style={styles.detailLabel}>{item.name}</Text>
                    <Text style={styles.detailValue}>{formatCurrency(item.amount)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.helperText}>No similar transactions yet.</Text>
              )}
            </SectionCard>

            {createRule ? (
              <SectionCard title="Rule preview">
                {rulePreview.length > 0 ? (
                  rulePreview.map((item) => (
                    <View key={item.id} style={styles.similarRow}>
                      <Text style={styles.detailLabel}>{item.name}</Text>
                      <Text style={styles.detailValue}>{formatCurrency(item.amount)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.helperText}>No matches for this rule yet.</Text>
                )}
              </SectionCard>
            ) : null}

            <View style={styles.actionRow}>
              <Pressable
                style={[styles.primaryButton, savingDetail && styles.buttonDisabled]}
                onPress={saveDetail}
                disabled={savingDetail}
              >
                <Text style={styles.primaryButtonText}>
                  {savingDetail ? 'Saving...' : 'Save changes'}
                </Text>
              </Pressable>
            </View>

            <SectionCard title="Splits">
              {splits.length === 0 ? (
                <Text style={styles.helperText}>No splits yet.</Text>
              ) : null}
              {splits.map((split, index) => (
                <View key={split.id ?? `${split.category}-${index}`} style={styles.splitRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="Category"
                    placeholderTextColor={colors.textMuted}
                    value={split.category}
                    onChangeText={(value) => updateSplit(index, 'category', value)}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Amount"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={String(split.amount)}
                    onChangeText={(value) => updateSplit(index, 'amount', value)}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Note (optional)"
                    placeholderTextColor={colors.textMuted}
                    value={split.note ?? ''}
                    onChangeText={(value) => updateSplit(index, 'note', value)}
                  />
                  <Pressable style={styles.removeButton} onPress={() => removeSplit(index)}>
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable style={styles.secondaryButton} onPress={addSplit}>
                <Text style={styles.secondaryButtonText}>Add split</Text>
              </Pressable>
            </SectionCard>

            <SectionCard title="Split totals">
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Allocated</Text>
                <Text style={styles.detailValue}>{formatCurrency(splitTotal)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Remaining</Text>
                <Text style={styles.detailValue}>{formatCurrency(remainingSplit)}</Text>
              </View>
            </SectionCard>

            <View style={styles.actionRow}>
              <Pressable
                style={[styles.secondaryButton, splitSaving && styles.buttonDisabled]}
                onPress={saveSplits}
                disabled={splitSaving || !canSaveSplits}
              >
                <Text style={styles.secondaryButtonText}>
                  {splitSaving ? 'Saving...' : 'Save splits'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        ) : null}
      </ModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 24,
    gap: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(18, 24, 46, 0.7)',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryValue: {
    color: colors.text,
    marginTop: 6,
    fontSize: 16,
    fontWeight: '700',
  },
  searchCard: {
    borderRadius: 16,
    backgroundColor: 'rgba(18, 24, 46, 0.7)',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: colors.text,
    paddingVertical: 10,
  },
  filterRow: {
    flexDirection: 'row',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(18, 24, 46, 0.7)',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  rowMeta: {
    flex: 1,
    paddingRight: 12,
  },
  merchant: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  category: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  amount: {
    fontWeight: '700',
    fontSize: 14,
  },
  amountNegative: {
    color: colors.danger,
  },
  amountPositive: {
    color: colors.success,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  tagWarning: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  tagInfo: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  sheetHeader: {
    marginBottom: 16,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  sheetAmount: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
  },
  sheetMeta: {
    color: colors.textMuted,
    marginTop: 4,
    fontSize: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  detailValue: {
    color: colors.text,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    marginTop: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  actionRow: {
    marginTop: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.background,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  similarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  splitRow: {
    marginTop: 10,
    gap: 6,
  },
  removeButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  removeButtonText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
  },
});
