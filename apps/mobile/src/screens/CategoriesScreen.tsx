import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import Chip from '../components/Chip';
import ModalSheet from '../components/ModalSheet';
import { Screen } from '../components/Screen';
import { apiRequest } from '../lib/api';
import { colors } from '../theme';

type CategoryRow = {
  name: string;
  spend: number;
  prevSpend: number;
  budget: number | null;
  color?: string | null;
  essential: boolean;
  projected: number;
  remaining: number | null;
  status: 'ok' | 'risk' | 'over' | 'neutral';
};

type GroupRow = {
  id: string;
  name: string;
  spend: number;
  budget: number | null;
  unassignedBudget: number | null;
  status: 'ok' | 'risk' | 'over' | 'neutral';
  categories: CategoryRow[];
};

type TransactionRow = {
  id: string;
  name: string;
  amount: number;
  category: string;
  date: string;
};

type OverviewResponse = {
  summary: {
    mode: 'budget' | 'compare';
    spend: number;
    budget: number;
    projected: number;
    prevSpend: number;
    changePct: number;
  };
  categories: CategoryRow[];
  groups: GroupRow[];
  transactions: TransactionRow[];
};

type TransactionDetail = {
  id: string;
  name: string;
  amount: number;
  category: string;
  transactionType?: 'INCOME' | 'INTERNAL_TRANSFER' | 'REGULAR';
  date: string;
  account?: {
    name?: string;
    institutionName?: string;
    mask?: string;
    type?: string;
  };
};

type CategoriesResponse = {
  categories: string[];
};

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

const formatCurrencyDetailed = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

const formatCurrencyCompact = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  });

const formatDayLabel = (value: string) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const formatMonthLabel = (value: string) =>
  new Date(value).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

const CATEGORY_PALETTE = [
  '#14b8a6',
  '#0ea5e9',
  '#22c55e',
  '#f97316',
  '#f43f5e',
  '#a855f7',
  '#f59e0b',
  '#06b6d4',
];
const CATEGORY_COLORS = CATEGORY_PALETTE;

const normalizeHex = (value: string) => {
  const color = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const [, r, g, b] = color;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
};

const fallbackCategoryColor = (name: string) => {
  const key = name.trim().toLowerCase();
  if (!key) return CATEGORY_PALETTE[0];
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
};

const resolveCategoryColor = (row: Pick<CategoryRow, 'name' | 'color'>) =>
  normalizeHex(row.color ?? '') ?? fallbackCategoryColor(row.name);

export function CategoriesScreen() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState('');
  const [essentialDraft, setEssentialDraft] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBudget, setNewBudget] = useState('');
  const [newEssential, setNewEssential] = useState(false);
  const [newColor, setNewColor] = useState(CATEGORY_COLORS[0]);
  const [groupOpen, setGroupOpen] = useState(false);
  const [categoryDetailOpen, setCategoryDetailOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupCategories, setGroupCategories] = useState('');
  const [groupBudget, setGroupBudget] = useState('');
  const [groupDraft, setGroupDraft] = useState<string>('');
  const [nameEditOpen, setNameEditOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameColorDraft, setNameColorDraft] = useState(CATEGORY_COLORS[0]);
  const [nameEditError, setNameEditError] = useState<string | null>(null);
  const [transactionDetailOpen, setTransactionDetailOpen] = useState(false);
  const [transactionDetailLoading, setTransactionDetailLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionDetail | null>(null);
  const [transactionCategoryInput, setTransactionCategoryInput] = useState('');
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [categoryChoices, setCategoryChoices] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const currentMonthLabel = useMemo(
    () => new Date().toLocaleDateString('en-US', { month: 'short' }),
    []
  );

  const load = async () => {
    try {
      const data = await apiRequest<OverviewResponse>('/api/categories/overview');
      setOverview(data);
      if (!selected && data.categories.length > 0) {
        const first = data.categories[0];
        setSelected(first.name);
        setBudgetDraft(first.budget ? String(first.budget) : '');
        setEssentialDraft(Boolean(first.essential));
      }
      setError(null);
    } catch (err) {
      const message =
        typeof err === 'object' && err && 'error' in err
          ? String((err as { error?: string }).error)
          : 'Unable to load categories.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadCategoryChoices = async () => {
    try {
      const data = await apiRequest<CategoriesResponse>('/api/categories');
      setCategoryChoices(data.categories ?? []);
    } catch {
      setCategoryChoices([]);
    }
  };

  useEffect(() => {
    load();
    loadCategoryChoices();
  }, []);

  const selectedRow = useMemo(() => {
    return overview?.categories.find((row) => row.name === selected) ?? null;
  }, [overview, selected]);
  const selectedCategoryColor = useMemo(
    () => (selectedRow ? resolveCategoryColor(selectedRow) : colors.accent),
    [selectedRow]
  );
  const selectedGroupId = useMemo(() => {
    if (!selectedRow || !overview?.groups) return '';
    const group = overview.groups.find((item) =>
      (item.categories ?? []).some((category) => category.name === selectedRow.name)
    );
    return group?.id ?? '';
  }, [overview, selectedRow]);

  const maxSpend = useMemo(() => {
    if (!overview?.categories?.length) return 1;
    return Math.max(...overview.categories.map((row) => row.budget ?? row.spend), 1);
  }, [overview]);

  const filteredTransactions = useMemo(() => {
    if (!selectedRow || !overview?.transactions) return [];
    return overview.transactions
      .filter((tx) => tx.category === selectedRow.name && tx.amount > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [overview, selectedRow]);

  const monthlySeries = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 12 }).map((_, index) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return {
        key,
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        value: 0,
      };
    });

    const monthIndex = new Map(months.map((month, index) => [month.key, index]));
    filteredTransactions.forEach((tx) => {
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const index = monthIndex.get(key);
      if (index !== undefined) {
        months[index].value += Math.abs(tx.amount);
      }
    });

    return months;
  }, [filteredTransactions]);

  const chartMax = useMemo(() => Math.max(1, ...monthlySeries.map((month) => month.value), 1), [monthlySeries]);

  const yearlyMetrics = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth() + 1;
    const totalSpend = filteredTransactions
      .filter((tx) => new Date(tx.date).getFullYear() === year)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    return {
      year,
      totalSpend,
      averagePerMonth: totalSpend / Math.max(monthIndex, 1),
    };
  }, [filteredTransactions]);

  const transactionsByMonth = useMemo(() => {
    const map = new Map<string, TransactionRow[]>();
    filteredTransactions.forEach((tx) => {
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const list = map.get(key) ?? [];
      list.push(tx);
      map.set(key, list);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([key, items]) => ({
        key,
        label: formatMonthLabel(items[0].date),
        items: items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      }));
  }, [filteredTransactions]);

  const openEdit = () => {
    if (!selectedRow) return;
    setBudgetDraft(selectedRow.budget ? String(selectedRow.budget) : '');
    setEssentialDraft(selectedRow.essential);
    setGroupDraft(selectedGroupId);
    // Close detail sheet first; iOS won't reliably stack a second RN Modal above it.
    setCategoryDetailOpen(false);
    setTimeout(() => setEditOpen(true), 180);
  };

  const saveCategory = async () => {
    if (!selectedRow) return;
    setSaving(true);
    try {
      await apiRequest('/api/categories', {
        method: 'POST',
        body: {
          name: selectedRow.name,
          essential: essentialDraft,
          monthlyBudget: budgetDraft ? Number(budgetDraft) : null,
        },
      });
      await apiRequest('/api/category-groups', {
        method: 'PATCH',
        body: {
          categoryName: selectedRow.name,
          groupId: groupDraft || null,
        },
      });
      await load();
    } finally {
      setSaving(false);
      setEditOpen(false);
    }
  };

  const openNameEditor = () => {
    if (!selectedRow) return;
    setNameDraft(selectedRow.name);
    setNameColorDraft(resolveCategoryColor(selectedRow));
    setNameEditError(null);
    setCategoryDetailOpen(false);
    setTimeout(() => setNameEditOpen(true), 180);
  };

  const saveNameAndColor = async () => {
    if (!selectedRow || !nameDraft.trim()) return;
    setSaving(true);
    const nextName = nameDraft.trim();
    try {
      await apiRequest('/api/categories', {
        method: 'POST',
        body: {
          currentName: selectedRow.name,
          name: nextName,
          color: nameColorDraft,
          essential: selectedRow.essential,
          monthlyBudget: selectedRow.budget,
        },
      });
      await load();
      await loadCategoryChoices();
      setSelected(nextName);
      setNameEditOpen(false);
      setCategoryDetailOpen(true);
      setNameEditError(null);
    } catch (err) {
      const message =
        typeof err === 'object' && err && 'error' in err
          ? String((err as { error?: string }).error)
          : 'Unable to update category name/color.';
      setNameEditError(message);
    } finally {
      setSaving(false);
    }
  };

  const openTransactionDetail = async (id: string) => {
    setTransactionDetailOpen(true);
    setTransactionDetailLoading(true);
    try {
      const detail = await apiRequest<TransactionDetail>(`/api/transactions/${id}`);
      setSelectedTransaction(detail);
      setTransactionCategoryInput(detail.category ?? '');
    } finally {
      setTransactionDetailLoading(false);
    }
  };

  const saveTransactionCategory = async () => {
    if (!selectedTransaction) return;
    const nextCategory = transactionCategoryInput.trim();
    if (!nextCategory) return;
    setSavingTransaction(true);
    try {
      const existing = new Set((categoryChoices ?? []).map((name) => name.toLowerCase()));
      if (!existing.has(nextCategory.toLowerCase())) {
        await apiRequest('/api/categories', {
          method: 'POST',
          body: {
            name: nextCategory,
            color: fallbackCategoryColor(nextCategory),
            essential: false,
            monthlyBudget: null,
          },
        });
      }
      await apiRequest(`/api/transactions/${selectedTransaction.id}`, {
        method: 'PATCH',
        body: {
          category: nextCategory,
        },
      });
      await loadCategoryChoices();
      await load();
      setTransactionDetailOpen(false);
    } finally {
      setSavingTransaction(false);
    }
  };

  const createCategory = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await apiRequest('/api/categories', {
        method: 'POST',
        body: {
          name: newName.trim(),
          color: newColor,
          essential: newEssential,
          monthlyBudget: newBudget ? Number(newBudget) : null,
        },
      });
      setNewName('');
      setNewBudget('');
      setNewEssential(false);
      setNewColor(CATEGORY_COLORS[0]);
      await load();
    } finally {
      setSaving(false);
      setAddOpen(false);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim()) return;
    setSaving(true);
    try {
      await apiRequest('/api/category-groups', {
        method: 'POST',
        body: {
          name: groupName.trim(),
          categories: groupCategories
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          unassignedBudget: groupBudget ? Number(groupBudget) : null,
        },
      });
      setGroupName('');
      setGroupCategories('');
      setGroupBudget('');
      await load();
    } finally {
      setSaving(false);
      setGroupOpen(false);
    }
  };

  return (
    <Screen title="Categories" subtitle="Monthly spend against budget." edgeToEdge>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>This month</Text>
            <Text style={styles.headerSubtitle}>Spent vs budget by category.</Text>
          </View>
          <View style={styles.headerButtons}>
            <Pressable style={styles.secondaryButton} onPress={() => setGroupOpen(true)}>
              <Text style={styles.secondaryLabel}>Group</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={() => setAddOpen(true)}>
              <Text style={styles.primaryLabel}>Add</Text>
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading categories...</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {overview ? (
          <>
            <View style={styles.monthTotalsRow}>
              <View style={styles.totalBlock}>
                <Text
                  style={styles.totalValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.62}
                >
                  {formatCurrency(overview.summary.spend)}
                </Text>
                <Text style={styles.totalLabel}>spent in {currentMonthLabel}</Text>
              </View>
              <SummaryDonut categories={overview.categories} total={overview.summary.spend} />
              <View style={[styles.totalBlock, styles.totalBlockRight]}>
                <Text
                  style={styles.totalValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.62}
                >
                  {formatCurrency(overview.summary.budget)}
                </Text>
                <Text style={styles.totalLabel}>total budget</Text>
              </View>
            </View>
            <Text
              style={[
                styles.totalDelta,
                overview.summary.spend > overview.summary.budget ? styles.totalDeltaOver : styles.totalDeltaUnder,
              ]}
            >
              {overview.summary.spend > overview.summary.budget
                ? `${formatCurrency(overview.summary.spend - overview.summary.budget)} over budget`
                : `${formatCurrency(overview.summary.budget - overview.summary.spend)} under budget`}
            </Text>
          </>
        ) : null}

        <View style={styles.listHeader}>
          <Text style={styles.listHeaderCategory}>Category</Text>
          <Text style={styles.listHeaderAmount}>Spent</Text>
          <Text style={styles.listHeaderBudget}>Budget</Text>
        </View>

        {(overview?.categories ?? []).length === 0 ? (
          <Text style={styles.emptyText}>No categories yet.</Text>
        ) : (
          overview?.categories.map((row) => {
            const budget = row.budget ?? 0;
            const ratio = row.budget
              ? row.spend / Math.max(budget, 1)
              : row.spend / Math.max(maxSpend, 1);
            const progress = Math.min(1, ratio);
            const categoryColor = resolveCategoryColor(row);
            const barColor = row.budget
              ? row.spend > budget
                ? colors.danger
                : row.spend > budget * 0.8
                  ? '#f59e0b'
                  : '#22c55e'
              : categoryColor;
            return (
              <Pressable
                key={row.name}
                onPress={() => {
                  setSelected(row.name);
                  setCategoryDetailOpen(true);
                }}
                style={[styles.compactRow, selected === row.name && styles.compactRowActive]}
              >
                <View style={styles.compactLine}>
                  <View style={styles.compactNameWrap}>
                    <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
                    <Text style={styles.compactName} numberOfLines={1}>
                      {row.name}
                    </Text>
                  </View>
                  <View style={styles.compactMetrics}>
                    <Text
                      style={styles.compactAmount}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {formatCurrencyCompact(row.spend)}
                    </Text>
                    <View style={styles.compactBarTrack}>
                      <View
                        style={[
                          styles.compactBarFill,
                          {
                            width: `${progress * 100}%`,
                            backgroundColor: barColor,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={styles.compactBudget}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {row.budget ? formatCurrencyCompact(row.budget) : '--'}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}

      </ScrollView>

      <ModalSheet visible={categoryDetailOpen} onClose={() => setCategoryDetailOpen(false)}>
        {selectedRow ? (
          <ScrollView contentContainerStyle={styles.categoryDetailContent} showsVerticalScrollIndicator={false}>
            <View style={styles.detailHeader}>
              <View>
                <View style={styles.detailTitleWrap}>
                  <View style={[styles.categoryDot, { backgroundColor: selectedCategoryColor }]} />
                  <Pressable onPress={openNameEditor} hitSlop={10} style={styles.nameEditButton}>
                    <Text style={[styles.sectionTitle, { color: selectedCategoryColor }]}>
                      {selectedRow.name}
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.sectionSubtitle}>
                  {selectedRow.essential ? 'Essential' : 'Flexible'} · {selectedRow.status}
                </Text>
                <Pressable onPress={openNameEditor} hitSlop={8}>
                  <Text style={styles.tapHint}>Edit name and color</Text>
                </Pressable>
              </View>
              <Pressable style={styles.secondaryButton} onPress={openEdit}>
                <Text style={styles.secondaryLabel}>Edit</Text>
              </Pressable>
            </View>

            <Text style={styles.sheetSectionTitle}>By month</Text>
            <View style={styles.chartCard}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartRow}>
                {monthlySeries.map((month) => {
                  const height = Math.max(4, (month.value / chartMax) * 96);
                  return (
                    <View key={month.key} style={styles.barColumn}>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              height,
                              backgroundColor: selectedCategoryColor,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.barLabel}>{month.label[0]}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.metricsCard}>
              <View style={styles.metricsHeader}>
                <Text style={styles.sheetSectionTitle}>Key metrics</Text>
                <Text style={styles.metricsYear}>{yearlyMetrics.year}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total spend this year</Text>
                <Text style={styles.detailValue}>-{formatCurrencyDetailed(yearlyMetrics.totalSpend)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Average per month this year</Text>
                <Text style={styles.detailValue}>{formatCurrencyDetailed(yearlyMetrics.averagePerMonth)}</Text>
              </View>
            </View>

            <View style={styles.transactionsBlock}>
              <Text style={styles.sheetSectionTitle}>Transactions</Text>
              {transactionsByMonth.length === 0 ? (
                <Text style={styles.emptyText}>No transactions yet.</Text>
              ) : (
                transactionsByMonth.map((group) => (
                  <View key={group.key} style={styles.monthGroup}>
                    <Text style={styles.monthTitle}>{group.label}</Text>
                    {group.items.map((tx) => (
                      <Pressable key={tx.id} onPress={() => openTransactionDetail(tx.id)} style={styles.transactionRow}>
                        <View style={styles.transactionLeft}>
                          <Text style={styles.transactionMeta}>{formatDayLabel(tx.date)}</Text>
                          <Text style={styles.transactionName}>{tx.name}</Text>
                        </View>
                        <Text style={styles.transactionAmount}>
                          -{formatCurrencyDetailed(Math.abs(tx.amount))}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>No category selected.</Text>
        )}
      </ModalSheet>

      <ModalSheet visible={editOpen} onClose={() => setEditOpen(false)}>
        <Text style={styles.modalTitle}>Update category</Text>
        <TextInput
          value={budgetDraft}
          onChangeText={setBudgetDraft}
          placeholder="Monthly budget"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          style={styles.input}
        />
        <Pressable
          style={[styles.toggleButton, essentialDraft && styles.toggleButtonActive]}
          onPress={() => setEssentialDraft((prev) => !prev)}
        >
          <Text style={styles.toggleLabel}>
            {essentialDraft ? 'Essential category' : 'Mark as essential'}
          </Text>
        </Pressable>
        <Text style={styles.modalSubLabel}>Category group</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupChipsRow}>
          <View style={styles.groupChipWrap}>
            <Chip label="No group" active={!groupDraft} onPress={() => setGroupDraft('')} />
          </View>
          {(overview?.groups ?? []).map((group) => (
            <View key={group.id} style={styles.groupChipWrap}>
              <Chip
                label={group.name}
                active={groupDraft === group.id}
                onPress={() => setGroupDraft(group.id)}
              />
            </View>
          ))}
        </ScrollView>
        <Pressable style={styles.primaryButton} onPress={saveCategory} disabled={saving}>
          <Text style={styles.primaryLabel}>{saving ? 'Saving...' : 'Save'}</Text>
        </Pressable>
      </ModalSheet>

      <ModalSheet visible={nameEditOpen} onClose={() => setNameEditOpen(false)}>
        <Text style={styles.modalTitle}>Edit category identity</Text>
        <TextInput
          value={nameDraft}
          onChangeText={setNameDraft}
          placeholder="Category name"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <ColorPalettePicker selected={nameColorDraft} onSelect={setNameColorDraft} />
        {nameEditError ? <Text style={styles.errorText}>{nameEditError}</Text> : null}
        <Pressable style={styles.primaryButton} onPress={saveNameAndColor} disabled={saving}>
          <Text style={styles.primaryLabel}>{saving ? 'Saving...' : 'Save name and color'}</Text>
        </Pressable>
      </ModalSheet>

      <ModalSheet visible={transactionDetailOpen} onClose={() => setTransactionDetailOpen(false)}>
        {transactionDetailLoading || !selectedTransaction ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading details...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.transactionDetailContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{selectedTransaction.name}</Text>
            <Text style={styles.sectionSubtitle}>
              {selectedTransaction.account?.institutionName ?? 'Account'} · {formatDayLabel(selectedTransaction.date)}
            </Text>
            <Text style={styles.transactionDetailAmount}>
              {selectedTransaction.amount < 0 ? '+' : '-'} {formatCurrencyDetailed(Math.abs(selectedTransaction.amount))}
            </Text>

            <Text style={styles.modalSubLabel}>Category</Text>
            <TextInput
              value={transactionCategoryInput}
              onChangeText={setTransactionCategoryInput}
              placeholder="Set or create category"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupChipsRow}>
              {categoryChoices.map((category) => (
                <View key={category} style={styles.groupChipWrap}>
                  <Chip
                    label={category}
                    active={transactionCategoryInput.trim().toLowerCase() === category.toLowerCase()}
                    onPress={() => setTransactionCategoryInput(category)}
                  />
                </View>
              ))}
            </ScrollView>
            <Pressable
              style={styles.primaryButton}
              onPress={saveTransactionCategory}
              disabled={savingTransaction}
            >
              <Text style={styles.primaryLabel}>{savingTransaction ? 'Saving...' : 'Save transaction'}</Text>
            </Pressable>
          </ScrollView>
        )}
      </ModalSheet>

      <ModalSheet visible={addOpen} onClose={() => setAddOpen(false)}>
        <Text style={styles.modalTitle}>Add category</Text>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="Category name"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <TextInput
          value={newBudget}
          onChangeText={setNewBudget}
          placeholder="Monthly budget"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          style={styles.input}
        />
        <Pressable
          style={[styles.toggleButton, newEssential && styles.toggleButtonActive]}
          onPress={() => setNewEssential((prev) => !prev)}
        >
          <Text style={styles.toggleLabel}>
            {newEssential ? 'Essential category' : 'Mark as essential'}
          </Text>
        </Pressable>
        <ColorPalettePicker selected={newColor} onSelect={setNewColor} />
        <Pressable style={styles.primaryButton} onPress={createCategory} disabled={saving}>
          <Text style={styles.primaryLabel}>{saving ? 'Saving...' : 'Create'}</Text>
        </Pressable>
      </ModalSheet>

      <ModalSheet visible={groupOpen} onClose={() => setGroupOpen(false)}>
        <Text style={styles.modalTitle}>Add category group</Text>
        <TextInput
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Group name"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <TextInput
          value={groupCategories}
          onChangeText={setGroupCategories}
          placeholder="Categories (comma separated)"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <TextInput
          value={groupBudget}
          onChangeText={setGroupBudget}
          placeholder="Unassigned budget"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          style={styles.input}
        />
        <Pressable style={styles.primaryButton} onPress={createGroup} disabled={saving}>
          <Text style={styles.primaryLabel}>{saving ? 'Saving...' : 'Create group'}</Text>
        </Pressable>
      </ModalSheet>
    </Screen>
  );
}

function SummaryDonut({
  categories,
  total,
}: {
  categories: CategoryRow[];
  total: number;
}) {
  const radius = 36;
  const stroke = 11;
  const circumference = 2 * Math.PI * radius;
  const normalizedTotal = Math.max(total, 1);
  const slices = categories
    .filter((row) => row.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 8);

  let offset = 0;
  return (
    <View style={styles.donutWrap}>
      <Svg width={96} height={96}>
        <G rotation="-90" origin="48, 48">
          <Circle
            cx={48}
            cy={48}
            r={radius}
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={stroke}
            fill="none"
          />
          {slices.map((slice) => {
            const pct = slice.spend / normalizedTotal;
            const arc = circumference * pct;
            const dashOffset = -offset;
            offset += arc;
            return (
              <Circle
                key={slice.name}
                cx={48}
                cy={48}
                r={radius}
                stroke={resolveCategoryColor(slice)}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${arc} ${circumference - arc}`}
                strokeDashoffset={dashOffset}
              />
            );
          })}
        </G>
      </Svg>
    </View>
  );
}

function ColorPalettePicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.colorPickerWrap}>
      <Text style={styles.colorPickerLabel}>Category color</Text>
      <View style={styles.colorPickerGrid}>
        {CATEGORY_COLORS.map((color) => (
          <Pressable
            key={color}
            onPress={() => onSelect(color)}
            style={[
              styles.colorSwatch,
              { backgroundColor: color },
              selected === color && styles.colorSwatchActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  primaryLabel: {
    color: colors.background,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  secondaryLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
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
  monthTotalsRow: {
    backgroundColor: 'rgba(17, 22, 43, 0.7)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  totalBlock: {
    flex: 1,
  },
  totalBlockRight: {
    alignItems: 'flex-end',
  },
  donutWrap: {
    width: 106,
    height: 106,
    borderRadius: 53,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  totalValue: {
    color: colors.text,
    fontSize: 29,
    fontWeight: '800',
    lineHeight: 32,
  },
  totalLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  totalDelta: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: -4,
    marginBottom: 2,
  },
  totalDeltaOver: {
    color: colors.danger,
  },
  totalDeltaUnder: {
    color: '#22c55e',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    marginTop: 4,
  },
  listHeaderCategory: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  listHeaderAmount: {
    width: 64,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    textAlign: 'right',
  },
  listHeaderBudget: {
    width: 64,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    textAlign: 'right',
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
  tapHint: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  compactRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  compactRowActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  compactLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  compactNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 0.39,
    minWidth: 0,
  },
  compactMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 0.61,
    gap: 6,
    minWidth: 0,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  compactName: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '500',
    flexShrink: 1,
  },
  compactAmount: {
    width: 56,
    color: colors.text,
    fontSize: 14,
    lineHeight: 17,
    textAlign: 'right',
    fontWeight: '600',
  },
  compactBarTrack: {
    flex: 1,
    minWidth: 62,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  compactBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  compactBudget: {
    width: 56,
    color: colors.text,
    fontSize: 14,
    lineHeight: 17,
    textAlign: 'right',
    fontWeight: '600',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameEditButton: {
    maxWidth: '90%',
  },
  categoryDetailContent: {
    gap: 12,
    paddingBottom: 8,
  },
  sheetSectionTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chartCard: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  chartRow: {
    alignItems: 'flex-end',
    gap: 10,
  },
  barColumn: {
    width: 24,
    alignItems: 'center',
    gap: 5,
  },
  barTrack: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 8,
    backgroundColor: colors.danger,
  },
  barLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  metricsCard: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 12,
    gap: 8,
  },
  metricsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricsYear: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
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
    fontSize: 13,
    fontWeight: '600',
  },
  transactionsBlock: {
    marginTop: 8,
    gap: 8,
  },
  monthGroup: {
    gap: 4,
    marginTop: 6,
  },
  monthTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  transactionName: {
    color: colors.text,
    fontSize: 13,
  },
  transactionMeta: {
    color: colors.textMuted,
    fontSize: 11,
  },
  transactionAmount: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalSubLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    marginBottom: 10,
    backgroundColor: 'rgba(9, 13, 27, 0.7)',
  },
  toggleButton: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 12,
  },
  toggleButtonActive: {
    borderColor: colors.primary,
  },
  toggleLabel: {
    color: colors.text,
    fontSize: 12,
  },
  groupChipsRow: {
    gap: 8,
    paddingBottom: 10,
    paddingRight: 8,
  },
  groupChipWrap: {
    marginBottom: 8,
  },
  transactionDetailContent: {
    gap: 10,
    paddingBottom: 8,
  },
  transactionDetailAmount: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  colorPickerWrap: {
    marginBottom: 12,
  },
  colorPickerLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  colorPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorSwatch: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  colorSwatchActive: {
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
