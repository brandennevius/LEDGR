import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
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

const sanitizeAmountInput = (value: string) => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const [whole, ...decimals] = cleaned.split('.');
  if (decimals.length === 0) return whole;
  return `${whole}.${decimals.join('').slice(0, 2)}`;
};

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SPEND' | 'INCOME'>('ALL');
  const [sortBy, setSortBy] = useState<'DATE_DESC' | 'AMOUNT_DESC' | 'AMOUNT_ASC'>('DATE_DESC');

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
  const [amountInput, setAmountInput] = useState('');
  const [editingAmount, setEditingAmount] = useState(false);
  const [activeSplitIndex, setActiveSplitIndex] = useState<number | null>(null);

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
    let rows = [...transactions];
    const trimmed = query.trim().toLowerCase();
    if (trimmed) {
      rows = rows.filter(
        (row) =>
          row.name.toLowerCase().includes(trimmed) ||
          row.category.toLowerCase().includes(trimmed)
      );
    }

    if (typeFilter === 'SPEND') {
      rows = rows.filter((row) => !row.isIncome);
    }
    if (typeFilter === 'INCOME') {
      rows = rows.filter((row) => row.isIncome);
    }

    rows.sort((a, b) => {
      if (sortBy === 'AMOUNT_DESC') return b.amount - a.amount;
      if (sortBy === 'AMOUNT_ASC') return a.amount - b.amount;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return rows;
  }, [query, sortBy, transactions, typeFilter]);

  const reviewCount = useMemo(() => transactions.filter((tx) => tx.needsReview).length, [transactions]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (days !== 30) count += 1;
    if (categoryFilter !== 'All') count += 1;
    if (needsReviewOnly) count += 1;
    if (typeFilter !== 'ALL') count += 1;
    if (sortBy !== 'DATE_DESC') count += 1;
    return count;
  }, [categoryFilter, days, needsReviewOnly, sortBy, typeFilter]);

  const existingCategoryNames = useMemo(
    () => categoryList.filter((name) => name !== 'All'),
    [categoryList]
  );

  const ensureCategoryExists = async (name: string) => {
    const nextCategory = name.trim();
    if (!nextCategory) return;
    const existing = new Set(existingCategoryNames.map((item) => item.toLowerCase()));
    if (existing.has(nextCategory.toLowerCase())) return;
    await apiRequest('/api/categories', {
      method: 'POST',
      body: {
        name: nextCategory,
        color: null,
        essential: false,
        monthlyBudget: null,
      },
    });
  };

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
      setSplits(
        (detail.splits ?? []).map((split) => ({
          category: split.category,
          amount: String(split.amount),
          note: split.note ?? '',
        }))
      );
      setActiveSplitIndex(null);
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
    const nextCategory = categoryInput.trim();
    if (!isCategorizationDisabled && !nextCategory) return;
    const parsedAmount = Number(amountInput);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setError('Enter a valid amount before saving.');
      return;
    }

    const signedAmount = parsedAmount * (selected.amount < 0 ? -1 : 1);
    setSavingDetail(true);
    try {
      if (!isCategorizationDisabled) {
        await ensureCategoryExists(nextCategory);
      }
      await apiRequest(`/api/transactions/${selected.id}`, {
        method: 'PATCH',
        body: {
          amount: signedAmount,
          ...(isCategorizationDisabled ? {} : { category: nextCategory }),
          transactionType: transactionTypeInput,
          applyToSimilar,
          applyToCategory: isCategorizationDisabled ? false : applyToCategory,
          createRule: isCategorizationDisabled ? false : createRule,
          ruleMatchType,
          ruleMatchValue,
        },
      });
      await fetchRows();
      await fetchCategories();
      setDetailOpen(false);
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

  const saveSplits = async () => {
    if (!selected) return;
    setSavingSplits(true);
    try {
      const uniqueSplitCategories = Array.from(
        new Set(
          splits
            .map((split) => split.category.trim())
            .filter(Boolean)
        )
      );
      await Promise.all(uniqueSplitCategories.map((category) => ensureCategoryExists(category)));

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
      await fetchCategories();
      setDetailOpen(false);
      setActiveSplitIndex(null);
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
    <Screen title="Transactions" subtitle="Review, filter, and recategorize." edgeToEdge>
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
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
          <Pressable style={styles.filterButton} onPress={() => setFiltersOpen(true)}>
            <Ionicons name="options-outline" size={20} color={colors.text} />
            {activeFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
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

      <ModalSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)}>
        <ScrollView
          contentContainerStyle={styles.filterSheetContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sheetTitle}>Filters</Text>

          <Text style={styles.sheetSection}>Filter by month</Text>
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

          <Text style={styles.sheetSection}>Filter by category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
            keyboardShouldPersistTaps="handled"
          >
            {(categoryList.length ? categoryList : ['All']).map((name) => (
              <View key={name}>
                <Chip label={name} active={categoryFilter === name} onPress={() => setCategoryFilter(name)} />
              </View>
            ))}
          </ScrollView>

          <Text style={styles.sheetSection}>Filter by review status ({reviewCount})</Text>
          <View style={styles.filterRow}>
            <Chip
              label={needsReviewOnly ? 'Needs review only' : 'All reviews'}
              active={needsReviewOnly}
              onPress={() => setNeedsReviewOnly((prev) => !prev)}
            />
          </View>

          <Text style={styles.sheetSection}>Filter by type</Text>
          <View style={styles.filterRow}>
            <Chip label="All" active={typeFilter === 'ALL'} onPress={() => setTypeFilter('ALL')} />
            <Chip label="Spend" active={typeFilter === 'SPEND'} onPress={() => setTypeFilter('SPEND')} />
            <Chip label="Income" active={typeFilter === 'INCOME'} onPress={() => setTypeFilter('INCOME')} />
          </View>

          <Text style={styles.sheetSection}>Other filters</Text>
          <View style={styles.placeholderList}>
            <Text style={styles.placeholderItem}>Filter by account (soon)</Text>
            <Text style={styles.placeholderItem}>Filter by recurring (soon)</Text>
            <Text style={styles.placeholderItem}>Filter by tag (soon)</Text>
          </View>

          <Text style={styles.sheetSection}>Sorting</Text>
          <View style={styles.filterRow}>
            <Chip label="Date" active={sortBy === 'DATE_DESC'} onPress={() => setSortBy('DATE_DESC')} />
            <Chip
              label="Amount (high to low)"
              active={sortBy === 'AMOUNT_DESC'}
              onPress={() => setSortBy('AMOUNT_DESC')}
            />
            <Chip
              label="Amount (low to high)"
              active={sortBy === 'AMOUNT_ASC'}
              onPress={() => setSortBy('AMOUNT_ASC')}
            />
          </View>

          <View style={styles.sheetActions}>
            <Pressable
              onPress={() => {
                setDays(30);
                setCategoryFilter('All');
                setNeedsReviewOnly(false);
                setTypeFilter('ALL');
                setSortBy('DATE_DESC');
                setQuery('');
              }}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryLabel}>Clear all</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={() => setFiltersOpen(false)}>
              <Text style={styles.primaryLabel}>Apply</Text>
            </Pressable>
          </View>
        </ScrollView>
      </ModalSheet>

      <ModalSheet visible={detailOpen} onClose={() => setDetailOpen(false)}>
        {detailLoading || !selected ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading details...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.detailContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.detailTitle}>{selected.name}</Text>
            <Text style={styles.detailSubtitle}>
              {selected.account?.institutionName ?? 'Account'} · {selected.date}
            </Text>
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
                  {selected.amount < 0 ? '+' : '-'} {formatCurrency(Math.abs(selected.amount))}
                </Text>
                <Text style={styles.detailAmountHint}>Tap amount to edit</Text>
              </Pressable>
            )}

            <Text style={styles.detailSectionTitle}>Category</Text>
            {transactionTypeInput !== 'REGULAR' ? (
              <Text style={styles.emptyText}>Categories are only available for regular transactions.</Text>
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
                  contentContainerStyle={styles.categoryScroll}
                  keyboardShouldPersistTaps="handled"
                >
                  {categoryList
                    .filter((name) => name !== 'All')
                    .map((name) => (
                      <View key={name}>
                        <Chip
                          label={name}
                          active={categoryInput.trim().toLowerCase() === name.toLowerCase()}
                          onPress={() => setCategoryInput(name)}
                        />
                      </View>
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

            <View style={styles.toggleRow}>
              <Pressable onPress={() => setApplyToSimilar((prev) => !prev)} style={styles.toggleButton}>
                <Text style={styles.toggleLabel}>
                  {applyToSimilar ? 'Apply to similar ✓' : 'Apply to similar'}
                </Text>
              </Pressable>
              {transactionTypeInput === 'REGULAR' ? (
                <Pressable onPress={() => setApplyToCategory((prev) => !prev)} style={styles.toggleButton}>
                  <Text style={styles.toggleLabel}>
                    {applyToCategory ? 'Apply to category ✓' : 'Apply to category'}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {transactionTypeInput === 'REGULAR' ? (
              <Pressable onPress={() => setCreateRule((prev) => !prev)} style={styles.toggleButton}>
                <Text style={styles.toggleLabel}>
                  {createRule ? 'Create rule ✓' : 'Create rule'}
                </Text>
              </Pressable>
            ) : null}
            {createRule && transactionTypeInput === 'REGULAR' ? (
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
              <View key={`split-${index}`} style={styles.splitGroup}>
                <View style={styles.splitRow}>
                <TextInput
                  value={split.category}
                  onChangeText={(value) => {
                    setSplits((prev) =>
                      prev.map((item, idx) => (idx === index ? { ...item, category: value } : item))
                    );
                  }}
                  onFocus={() => setActiveSplitIndex(index)}
                  placeholder="Category"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, styles.splitInput]}
                  blurOnSubmit={false}
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
                {activeSplitIndex === index ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryScroll}
                    keyboardShouldPersistTaps="handled"
                  >
                    {existingCategoryNames.map((name) => (
                      <View key={`split-choice-${index}-${name}`}>
                        <Chip
                          label={name}
                          active={split.category.trim().toLowerCase() === name.toLowerCase()}
                          onPress={() =>
                            setSplits((prev) =>
                              prev.map((item, idx) => (idx === index ? { ...item, category: name } : item))
                            )
                          }
                        />
                      </View>
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            ))}
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                setSplits((prev) => [...prev, { category: '', amount: '' }]);
                setActiveSplitIndex(splits.length);
              }}
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
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 12,
    gap: 10,
    backgroundColor: 'rgba(17, 22, 43, 0.45)',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: colors.text,
  },
  filterButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(9, 13, 27, 0.65)',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: colors.background,
    fontSize: 10,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterSheetContent: {
    gap: 12,
    paddingBottom: 18,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sheetSection: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 6,
  },
  categoryScroll: {
    gap: 8,
    paddingRight: 6,
  },
  placeholderList: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  placeholderItem: {
    color: colors.textMuted,
    fontSize: 13,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
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
  emptyCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(18, 24, 46, 0.35)',
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
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
    backgroundColor: 'transparent',
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
    fontSize: 18,
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
  splitGroup: {
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
