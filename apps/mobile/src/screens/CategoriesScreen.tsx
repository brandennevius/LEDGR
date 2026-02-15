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
        setSelected(data.categories[0].name);
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

  const maxSpend = useMemo(() => {
    if (!overview?.categories?.length) return 1;
    return Math.max(...overview.categories.map((row) => row.budget ?? row.spend), 1);
  }, [overview]);

  const filteredTransactions = useMemo(() => {
    if (!selectedRow || !overview?.transactions) return [];
    return overview.transactions
      .filter((tx) => tx.category === selectedRow.name && tx.amount > 0)
      .slice(0, 8);
  }, [overview, selectedRow]);

  const openEdit = () => {
    if (!selectedRow) return;
    setBudgetDraft(selectedRow.budget ? String(selectedRow.budget) : '');
    setEssentialDraft(selectedRow.essential);
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
          essential: newEssential,
          monthlyBudget: newBudget ? Number(newBudget) : null,
        },
      });
      setNewName('');
      setNewBudget('');
      setNewEssential(false);
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
                    ? group.categories.join(', ')
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
              return (
                <Pressable
                  key={row.name}
                  onPress={() => {
                    setSelected(row.name);
                    setCategoryDetailOpen(true);
                  }}
                  style={[styles.categoryRow, selected === row.name && styles.categoryRowActive]}
                >
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryName}>{row.name}</Text>
                    <Text style={styles.categoryAmount}>{formatCurrency(row.spend)}</Text>
                  </View>
                  <View style={styles.categoryBarTrack}>
                    <View style={[styles.categoryBarFill, { width: `${progress}%` }]} />
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
                <Text style={styles.sectionTitle}>{selectedRow.name}</Text>
                <Text style={styles.sectionSubtitle}>
                  {selectedRow.essential ? 'Essential' : 'Flexible'} · {selectedRow.status}
                </Text>
              </View>
              <Pressable style={styles.secondaryButton} onPress={openEdit}>
                <Text style={styles.secondaryLabel}>Edit</Text>
              </Pressable>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Spend</Text>
              <Text style={styles.detailValue}>{formatCurrency(selectedRow.spend)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Budget</Text>
              <Text style={styles.detailValue}>
                {selectedRow.budget ? formatCurrency(selectedRow.budget) : '--'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Projected</Text>
              <Text style={styles.detailValue}>{formatCurrency(selectedRow.projected)}</Text>
            </View>

            <View style={styles.transactionsBlock}>
              <Text style={styles.sectionSubtitle}>Recent transactions</Text>
              {filteredTransactions.length === 0 ? (
                <Text style={styles.emptyText}>No transactions yet.</Text>
              ) : (
                filteredTransactions.map((tx) => (
                  <View key={tx.id} style={styles.transactionRow}>
                    <View>
                      <Text style={styles.transactionName}>{tx.name}</Text>
                      <Text style={styles.transactionMeta}>{formatDayLabel(tx.date)}</Text>
                    </View>
                    <Text style={styles.transactionAmount}>
                      -{formatCurrencyDetailed(Math.abs(tx.amount))}
                    </Text>
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
  categoryDetailContent: {
    gap: 12,
    paddingBottom: 8,
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
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  transactionName: {
    color: colors.text,
    fontSize: 13,
  },
  transactionMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
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
});
