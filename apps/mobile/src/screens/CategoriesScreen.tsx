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
  const [colorDraft, setColorDraft] = useState(CATEGORY_COLORS[0]);
  const [newName, setNewName] = useState('');
  const [newBudget, setNewBudget] = useState('');
  const [newEssential, setNewEssential] = useState(false);
  const [newColor, setNewColor] = useState(CATEGORY_COLORS[0]);
  const [groupOpen, setGroupOpen] = useState(false);
  const [categoryDetailOpen, setCategoryDetailOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupCategories, setGroupCategories] = useState('');
  const [groupBudget, setGroupBudget] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await apiRequest<OverviewResponse>('/api/categories/overview');
      setOverview(data);
      if (!selected && data.categories.length > 0) {
        const first = data.categories[0];
        setSelected(first.name);
        setBudgetDraft(first.budget ? String(first.budget) : '');
        setEssentialDraft(Boolean(first.essential));
        setColorDraft(resolveCategoryColor(first));
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

  useEffect(() => {
    load();
  }, []);

  const selectedRow = useMemo(() => {
    return overview?.categories.find((row) => row.name === selected) ?? null;
  }, [overview, selected]);
  const selectedCategoryColor = useMemo(
    () => (selectedRow ? resolveCategoryColor(selectedRow) : colors.accent),
    [selectedRow]
  );

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
    setColorDraft(resolveCategoryColor(selectedRow));
    setEditOpen(true);
  };

  const saveCategory = async () => {
    if (!selectedRow) return;
    setSaving(true);
    try {
      await apiRequest('/api/categories', {
        method: 'POST',
        body: {
          name: selectedRow.name,
          color: colorDraft,
          essential: essentialDraft,
          monthlyBudget: budgetDraft ? Number(budgetDraft) : null,
        },
      });
      await load();
    } finally {
      setSaving(false);
      setEditOpen(false);
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
    <Screen title="Categories" subtitle="Budgets, pacing, and groups.">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Categories overview</Text>
            <Text style={styles.headerSubtitle}>Track budgets and compare to last month.</Text>
          </View>
          <View style={styles.headerButtons}>
            <Pressable style={styles.secondaryButton} onPress={() => setGroupOpen(true)}>
              <Text style={styles.secondaryLabel}>Add group</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={() => setAddOpen(true)}>
              <Text style={styles.primaryLabel}>Add</Text>
            </Pressable>
          </View>
        </View>

        {(overview?.groups ?? []).length > 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Category groups</Text>
            {(overview?.groups ?? []).map((group) => (
              <View key={group.id} style={styles.groupRow}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupName}>{group.name}</Text>
                  <Text style={styles.groupAmount}>{formatCurrency(group.spend)}</Text>
                </View>
                <Text style={styles.groupMeta}>
                  {(group.categories ?? []).length > 0
                    ? group.categories.map((item) => item.name).join(', ')
                    : 'No categories assigned'}
                </Text>
                <Text style={styles.groupMeta}>
                  Budget {group.budget ? formatCurrency(group.budget) : '--'}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Category groups</Text>
            <Text style={styles.emptyText}>No groups yet. Create one to organize categories.</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading categories...</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {overview ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>
              {overview.summary.mode === 'budget' ? 'Budget pacing' : 'Spend comparison'}
            </Text>
            <Text style={styles.summaryValue}>{formatCurrency(overview.summary.spend)} spent</Text>
            <Text style={styles.summarySubtitle}>
              {overview.summary.mode === 'budget'
                ? `${formatCurrency(overview.summary.projected)} projected vs ${formatCurrency(
                    overview.summary.budget
                  )} budget`
                : `${overview.summary.changePct.toFixed(0)}% vs last month`}
            </Text>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Categories</Text>
          {(overview?.categories ?? []).length === 0 ? (
            <Text style={styles.emptyText}>No categories yet.</Text>
          ) : (
            overview?.categories.map((row) => {
              const progress = row.budget
                ? Math.min(100, (row.spend / row.budget) * 100)
                : Math.min(100, (row.spend / maxSpend) * 100);
              const categoryColor = resolveCategoryColor(row);
              return (
                <Pressable
                  key={row.name}
                  onPress={() => {
                    setSelected(row.name);
                    setCategoryDetailOpen(true);
                  }}
                  style={[
                    styles.categoryRow,
                    selected === row.name && styles.categoryRowActive,
                    selected === row.name && {
                      borderColor: categoryColor,
                      backgroundColor: `${categoryColor}1A`,
                    },
                  ]}
                >
                  <View style={styles.categoryHeader}>
                    <View style={styles.categoryNameWrap}>
                      <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
                      <Text style={styles.categoryName}>{row.name}</Text>
                    </View>
                    <Text style={styles.categoryAmount}>{formatCurrency(row.spend)}</Text>
                  </View>
                  <View style={styles.categoryBarTrack}>
                    <View
                      style={[
                        styles.categoryBarFill,
                        {
                          width: `${progress}%`,
                          backgroundColor: categoryColor,
                        },
                      ]}
                    />
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

      </ScrollView>

      <ModalSheet visible={categoryDetailOpen} onClose={() => setCategoryDetailOpen(false)}>
        {selectedRow ? (
          <ScrollView contentContainerStyle={styles.categoryDetailContent} showsVerticalScrollIndicator={false}>
            <View style={styles.detailHeader}>
              <View>
                <View style={styles.detailTitleWrap}>
                  <View style={[styles.categoryDot, { backgroundColor: selectedCategoryColor }]} />
                  <Text style={[styles.sectionTitle, { color: selectedCategoryColor }]}>
                    {selectedRow.name}
                  </Text>
                </View>
                <Text style={styles.sectionSubtitle}>
                  {selectedRow.essential ? 'Essential' : 'Flexible'} · {selectedRow.status}
                </Text>
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
                      <View key={tx.id} style={styles.transactionRow}>
                        <View style={styles.transactionLeft}>
                          <Text style={styles.transactionMeta}>{formatDayLabel(tx.date)}</Text>
                          <Text style={styles.transactionName}>{tx.name}</Text>
                        </View>
                        <Text style={styles.transactionAmount}>
                          -{formatCurrencyDetailed(Math.abs(tx.amount))}
                        </Text>
                      </View>
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
        <ColorPalettePicker selected={colorDraft} onSelect={setColorDraft} />
        <Pressable style={styles.primaryButton} onPress={saveCategory} disabled={saving}>
          <Text style={styles.primaryLabel}>{saving ? 'Saving...' : 'Save'}</Text>
        </Pressable>
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
  summaryCard: {
    backgroundColor: 'rgba(17, 22, 43, 0.7)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
  },
  summarySubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  groupRow: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  groupName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  groupAmount: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  groupMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: 'rgba(17, 22, 43, 0.7)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 12,
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
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  categoryRow: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  categoryRowActive: {
    borderColor: colors.primary,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  categoryNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
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
