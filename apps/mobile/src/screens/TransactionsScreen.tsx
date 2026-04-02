import { useCallback, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
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
  accountId?: string;
  name: string;
  category: string;
  amount: number;
  isInflow?: boolean;
  isIncome: boolean;
  transactionType?: 'INCOME' | 'INTERNAL_TRANSFER' | 'REGULAR';
  needsReview?: boolean;
  hasSplits?: boolean;
  date: string;
  dateIso?: string;
};

type TransactionDetail = {
  id: string;
  name: string;
  amount: number;
  isInflow?: boolean;
  isIncome: boolean;
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
  accounts?: AccountOption[];
};

type AccountOption = {
  id: string;
  name: string;
  institutionName?: string | null;
  mask?: string | null;
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
  { label: '180d', value: 180 },
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

const buildMonthOptions = (count = 12) => {
  const options: Array<{ value: string; label: string }> = [];
  const cursor = new Date();
  cursor.setDate(1);
  for (let index = 0; index < count; index += 1) {
    const value = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    options.push({
      value,
      label: cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    });
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return options;
};

const buildYearOptions = (count = 4) => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: count }, (_, index) => String(currentYear - index));
};

export function TransactionsScreen() {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [periodMode, setPeriodMode] = useState<'ROLLING' | 'MONTH' | 'YEAR'>('ROLLING');
  const [monthFilter, setMonthFilter] = useState(buildMonthOptions(1)[0]?.value ?? '');
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [accountFilter, setAccountFilter] = useState('ALL');
  const [reviewFilter, setReviewFilter] = useState<'ALL' | 'NEEDS_REVIEW' | 'REVIEWED'>('ALL');
  const [categoryList, setCategoryList] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SPEND' | 'INCOME' | 'INTERNAL_TRANSFER'>('ALL');
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
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const yearOptions = useMemo(() => buildYearOptions(), []);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (periodMode === 'MONTH' && monthFilter) {
        params.set('month', monthFilter);
      } else if (periodMode === 'YEAR' && yearFilter) {
        params.set('year', yearFilter);
      } else {
        params.set('days', String(days));
      }
      if (categoryFilter !== 'All') params.set('category', categoryFilter);
      if (accountFilter !== 'ALL') params.set('accountId', accountFilter);
      const data = await apiRequest<TransactionsResponse>(`/api/transactions?${params.toString()}`);
      setTransactions(data.transactions ?? []);
      setAccounts(data.accounts ?? []);
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
  }, [accountFilter, categoryFilter, days, monthFilter, periodMode, yearFilter]);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await apiRequest<CategoriesResponse>('/api/categories');
      setCategoryList(['All', ...(data.categories ?? [])]);
    } catch {
      setCategoryList(['All']);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchRows();
      void fetchCategories();
    }, [fetchCategories, fetchRows])
  );

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

    if (reviewFilter === 'NEEDS_REVIEW') {
      rows = rows.filter((row) => row.needsReview);
    }
    if (reviewFilter === 'REVIEWED') {
      rows = rows.filter((row) => !row.needsReview);
    }

    if (typeFilter === 'SPEND') {
      rows = rows.filter(
        (row) => row.transactionType !== 'INTERNAL_TRANSFER' && !row.isIncome
      );
    }
    if (typeFilter === 'INCOME') {
      rows = rows.filter((row) => row.isIncome);
    }
    if (typeFilter === 'INTERNAL_TRANSFER') {
      rows = rows.filter((row) => row.transactionType === 'INTERNAL_TRANSFER');
    }

    rows.sort((a, b) => {
      if (sortBy === 'AMOUNT_DESC') return b.amount - a.amount;
      if (sortBy === 'AMOUNT_ASC') return a.amount - b.amount;
      return new Date(b.dateIso ?? b.date).getTime() - new Date(a.dateIso ?? a.date).getTime();
    });

    return rows;
  }, [query, reviewFilter, sortBy, transactions, typeFilter]);

  const reviewCount = useMemo(() => transactions.filter((tx) => tx.needsReview).length, [transactions]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (periodMode !== 'ROLLING' || days !== 30) count += 1;
    if (accountFilter !== 'ALL') count += 1;
    if (categoryFilter !== 'All') count += 1;
    if (reviewFilter !== 'ALL') count += 1;
    if (typeFilter !== 'ALL') count += 1;
    if (sortBy !== 'DATE_DESC') count += 1;
    return count;
  }, [accountFilter, categoryFilter, days, periodMode, reviewFilter, sortBy, typeFilter]);

  const existingCategoryNames = useMemo(
    () => categoryList.filter((name) => name !== 'All'),
    [categoryList]
  );
  const filteredCategoryNames = useMemo(() => {
    const needle = categoryInput.trim().toLowerCase();
    if (!needle) return existingCategoryNames;
    return existingCategoryNames.filter((name) => name.toLowerCase().includes(needle));
  }, [categoryInput, existingCategoryNames]);
  const hasExactCategoryMatch = useMemo(
    () => existingCategoryNames.some((name) => name.toLowerCase() === categoryInput.trim().toLowerCase()),
    [categoryInput, existingCategoryNames]
  );

  const getFilteredSplitCategories = (value: string) => {
    const needle = value.trim().toLowerCase();
    if (!needle) return existingCategoryNames;
    return existingCategoryNames.filter((name) => name.toLowerCase().includes(needle));
  };

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
            <Text style={styles.emptyTitle}>No transactions found</Text>
            <Text style={styles.emptyBody}>
              {transactions.length === 0
                ? 'Connect a bank account to start syncing.'
                : 'Adjust your search or filters to widen the results.'}
            </Text>
          </View>
        ) : null}

        {filteredRows.map((item) => {
          const isInflow = item.isInflow ?? item.isIncome;
          return (
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
              <Text style={[styles.amount, isInflow ? styles.positive : styles.negative]}>
                {isInflow ? '+' : '-'}
                {formatCurrency(item.amount)}
              </Text>
            </View>
          </Pressable>
          );
        })}
      </ScrollView>

      <ModalSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)}>
        <ScrollView
          contentContainerStyle={styles.filterSheetContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sheetTitle}>Filters</Text>

          <Text style={styles.sheetSection}>Date range</Text>
          <View style={styles.filterRow}>
            <Chip label="Rolling" active={periodMode === 'ROLLING'} onPress={() => setPeriodMode('ROLLING')} />
            <Chip label="Month" active={periodMode === 'MONTH'} onPress={() => setPeriodMode('MONTH')} />
            <Chip label="Year" active={periodMode === 'YEAR'} onPress={() => setPeriodMode('YEAR')} />
          </View>
          {periodMode === 'ROLLING' ? (
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
          ) : null}
          {periodMode === 'MONTH' ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
              keyboardShouldPersistTaps="handled"
            >
              {monthOptions.map((option) => (
                <View key={option.value}>
                  <Chip
                    label={option.label}
                    active={monthFilter === option.value}
                    onPress={() => setMonthFilter(option.value)}
                  />
                </View>
              ))}
            </ScrollView>
          ) : null}
          {periodMode === 'YEAR' ? (
            <View style={styles.filterRow}>
              {yearOptions.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  active={yearFilter === option}
                  onPress={() => setYearFilter(option)}
                />
              ))}
            </View>
          ) : null}

          <Text style={styles.sheetSection}>Filter by account</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
            keyboardShouldPersistTaps="handled"
          >
            <View>
              <Chip label="All accounts" active={accountFilter === 'ALL'} onPress={() => setAccountFilter('ALL')} />
            </View>
            {accounts.map((account) => (
              <View key={account.id}>
                <Chip
                  label={`${account.institutionName ?? account.name}${account.mask ? ` •${account.mask}` : ''}`}
                  active={accountFilter === account.id}
                  onPress={() => setAccountFilter(account.id)}
                />
              </View>
            ))}
          </ScrollView>

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

          <Text style={styles.sheetSection}>Review status ({reviewCount})</Text>
          <View style={styles.filterRow}>
            <Chip label="All" active={reviewFilter === 'ALL'} onPress={() => setReviewFilter('ALL')} />
            <Chip
              label="Needs review"
              active={reviewFilter === 'NEEDS_REVIEW'}
              onPress={() => setReviewFilter('NEEDS_REVIEW')}
            />
            <Chip
              label="Reviewed"
              active={reviewFilter === 'REVIEWED'}
              onPress={() => setReviewFilter('REVIEWED')}
            />
          </View>

          <Text style={styles.sheetSection}>Filter by type</Text>
          <View style={styles.filterRow}>
            <Chip label="All" active={typeFilter === 'ALL'} onPress={() => setTypeFilter('ALL')} />
            <Chip label="Spend" active={typeFilter === 'SPEND'} onPress={() => setTypeFilter('SPEND')} />
            <Chip label="Income" active={typeFilter === 'INCOME'} onPress={() => setTypeFilter('INCOME')} />
            <Chip
              label="Internal transfers"
              active={typeFilter === 'INTERNAL_TRANSFER'}
              onPress={() => setTypeFilter('INTERNAL_TRANSFER')}
            />
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
                setPeriodMode('ROLLING');
                setDays(30);
                setMonthFilter(monthOptions[0]?.value ?? '');
                setYearFilter(String(new Date().getFullYear()));
                setAccountFilter('ALL');
                setCategoryFilter('All');
                setReviewFilter('ALL');
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
                  {(selected.isInflow ?? selected.amount < 0) ? '+' : '-'} {formatCurrency(Math.abs(selected.amount))}
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
                  placeholder="Type to filter or create a category"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  blurOnSubmit={false}
                />
                <Text style={styles.categoryHelperText}>
                  Start typing to narrow the list, then tap a category below.
                </Text>
                <View style={styles.categoryPicker}>
                  <ScrollView nestedScrollEnabled style={styles.categoryPickerScroll} keyboardShouldPersistTaps="handled">
                    {!hasExactCategoryMatch && categoryInput.trim() ? (
                      <Pressable onPress={() => setCategoryInput(categoryInput.trim())} style={styles.categoryOption}>
                        <View style={styles.categoryOptionCopy}>
                          <Text style={styles.categoryOptionLabel}>Create "{categoryInput.trim()}"</Text>
                          <Text style={styles.categoryOptionHint}>Save to add this new category</Text>
                        </View>
                        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                      </Pressable>
                    ) : null}
                    {filteredCategoryNames.map((name) => {
                      const isActive = categoryInput.trim().toLowerCase() === name.toLowerCase();
                      return (
                        <Pressable
                          key={name}
                          onPress={() => setCategoryInput(name)}
                          style={[styles.categoryOption, isActive && styles.categoryOptionActive]}
                        >
                          <Text style={[styles.categoryOptionLabel, isActive && styles.categoryOptionLabelActive]}>
                            {name}
                          </Text>
                          {isActive ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                        </Pressable>
                      );
                    })}
                    {filteredCategoryNames.length === 0 && hasExactCategoryMatch === false && !categoryInput.trim() ? (
                      <Text style={styles.emptyText}>No categories yet.</Text>
                    ) : null}
                    {filteredCategoryNames.length === 0 && categoryInput.trim() ? (
                      <Text style={styles.emptyText}>No matches. Save to create this category.</Text>
                    ) : null}
                  </ScrollView>
                </View>
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
                  placeholder="Type to filter or create"
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
                  <View style={styles.categoryPicker}>
                    <ScrollView nestedScrollEnabled style={styles.categoryPickerScroll} keyboardShouldPersistTaps="handled">
                      {!existingCategoryNames.some(
                        (name) => name.toLowerCase() === split.category.trim().toLowerCase()
                      ) && split.category.trim() ? (
                        <Pressable
                          onPress={() =>
                            setSplits((prev) =>
                              prev.map((item, idx) =>
                                idx === index ? { ...item, category: split.category.trim() } : item
                              )
                            )
                          }
                          style={styles.categoryOption}
                        >
                          <View style={styles.categoryOptionCopy}>
                            <Text style={styles.categoryOptionLabel}>Create "{split.category.trim()}"</Text>
                            <Text style={styles.categoryOptionHint}>Save splits to add it</Text>
                          </View>
                          <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                        </Pressable>
                      ) : null}
                      {getFilteredSplitCategories(split.category).map((name) => {
                        const isActive = split.category.trim().toLowerCase() === name.toLowerCase();
                        return (
                          <Pressable
                            key={`split-choice-${index}-${name}`}
                            onPress={() =>
                              setSplits((prev) =>
                                prev.map((item, idx) => (idx === index ? { ...item, category: name } : item))
                              )
                            }
                            style={[styles.categoryOption, isActive && styles.categoryOptionActive]}
                          >
                            <Text style={[styles.categoryOptionLabel, isActive && styles.categoryOptionLabelActive]}>
                              {name}
                            </Text>
                            {isActive ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                          </Pressable>
                        );
                      })}
                      {getFilteredSplitCategories(split.category).length === 0 && split.category.trim() ? (
                        <Text style={styles.emptyText}>No matches. Save splits to create this category.</Text>
                      ) : null}
                    </ScrollView>
                  </View>
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
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
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
    backgroundColor: colors.surface,
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
  categoryHelperText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: -2,
  },
  categoryPicker: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  categoryPickerScroll: {
    maxHeight: 220,
  },
  categoryOption: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  categoryOptionActive: {
    backgroundColor: colors.primarySoft,
  },
  categoryOptionCopy: {
    flex: 1,
    gap: 2,
  },
  categoryOptionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryOptionLabelActive: {
    color: colors.primary,
  },
  categoryOptionHint: {
    color: colors.textMuted,
    fontSize: 11,
  },
  placeholderList: {
    backgroundColor: colors.surfaceMuted,
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
  },
  emptyCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.surface,
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
    borderColor: colors.inputBorder,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: colors.inputBg,
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
    borderColor: colors.inputBorder,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: colors.inputBg,
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
    backgroundColor: colors.surface,
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
