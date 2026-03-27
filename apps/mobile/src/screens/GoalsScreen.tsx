import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Pressable,
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

type GoalType = 'SAVINGS' | 'SPEND_LIMIT' | 'INCOME_TARGET' | 'DEBT' | 'BUFFER_DAYS';

type Goal = {
  id: string;
  name: string;
  type: GoalType;
  cadence: string;
  target: number;
  current: number;
  category?: string | null;
  accountId?: string | null;
  minPayment?: number | null;
  interestRate?: number | null;
  termMonths?: number | null;
  status?: 'ACTIVE' | 'COMPLETED' | null;
  startDate?: string | null;
  endDate?: string | null;
};

type GoalsResponse = {
  goals: Goal[];
};

type GoalSummaryResponse = {
  status: 'on_track' | 'at_risk' | 'off_track';
  summary: string;
};

type DebtAccount = {
  id: string;
  name: string;
  institutionName?: string | null;
  mask?: string | null;
  balance: number;
  estimatedPayment?: number | null;
};

type GoalSetupDataResponse = {
  debtAccounts: DebtAccount[];
  hasExistingGoals: boolean;
  liquidCash: number;
};

type CategoriesResponse = {
  categories: string[];
};

type GoalTemplateId =
  | 'EMERGENCY'
  | 'SAVINGS'
  | 'DEBT'
  | 'SPEND_LIMIT'
  | 'INCOME_TARGET'
  | 'BUFFER_DAYS';

type GoalTemplate = {
  id: GoalTemplateId;
  type: GoalType;
  label: string;
  description: string;
  defaultName: string;
};

type GoalFormState = {
  templateId: GoalTemplateId;
  name: string;
  target: string;
  category: string;
  endDate: string;
  accountId: string;
  minPayment: string;
  interestRate: string;
  termMonths: string;
};

const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    id: 'EMERGENCY',
    type: 'SAVINGS',
    label: 'Emergency fund',
    description: 'Build a cash buffer for unexpected expenses.',
    defaultName: 'Emergency fund',
  },
  {
    id: 'SAVINGS',
    type: 'SAVINGS',
    label: 'Savings goal',
    description: 'Save toward a specific milestone.',
    defaultName: 'Savings goal',
  },
  {
    id: 'DEBT',
    type: 'DEBT',
    label: 'Debt payoff',
    description: 'Track payoff progress and minimum payments.',
    defaultName: 'Debt payoff',
  },
  {
    id: 'SPEND_LIMIT',
    type: 'SPEND_LIMIT',
    label: 'Spend limit',
    description: 'Keep a category or month inside a cap.',
    defaultName: 'Monthly spend cap',
  },
  {
    id: 'INCOME_TARGET',
    type: 'INCOME_TARGET',
    label: 'Income target',
    description: 'Track incoming cash against a target.',
    defaultName: 'Income target',
  },
  {
    id: 'BUFFER_DAYS',
    type: 'BUFFER_DAYS',
    label: 'Buffer days',
    description: 'Track how many days of runway you have.',
    defaultName: 'Cash buffer',
  },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

const buildInitialForm = (templateId: GoalTemplateId): GoalFormState => {
  const template = GOAL_TEMPLATES.find((option) => option.id === templateId) ?? GOAL_TEMPLATES[0];
  return {
    templateId,
    name: template.defaultName,
    target: '',
    category: '',
    endDate: '',
    accountId: 'manual',
    minPayment: '',
    interestRate: '',
    termMonths: '',
  };
};

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

const formatGoalValue = (goal: Pick<Goal, 'type'>, value: number) =>
  goal.type === 'BUFFER_DAYS' ? `${value.toFixed(1)} days` : formatCurrency(value);

const formatDateLabel = (value?: string | null) => {
  if (!value) return 'No target date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No target date';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const goalTypeLabel = (type: GoalType) => {
  switch (type) {
    case 'SAVINGS':
      return 'Savings target';
    case 'SPEND_LIMIT':
      return 'Spend limit';
    case 'INCOME_TARGET':
      return 'Income target';
    case 'DEBT':
      return 'Debt payoff';
    case 'BUFFER_DAYS':
      return 'Buffer days';
    default:
      return String(type).replace(/_/g, ' ').toLowerCase();
  }
};

const sanitizeNumericInput = (value: string) => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const [whole, ...decimals] = cleaned.split('.');
  if (decimals.length === 0) return whole;
  return `${whole}.${decimals.join('').slice(0, 2)}`;
};

export function GoalsScreen() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<GoalSummaryResponse | null>(null);
  const [debtAccounts, setDebtAccounts] = useState<DebtAccount[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [liquidCash, setLiquidCash] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [insightOpen, setInsightOpen] = useState(false);
  const [selectedInsightGoal, setSelectedInsightGoal] = useState<string | null>(null);
  const [insightText, setInsightText] = useState('');
  const [insightLoading, setInsightLoading] = useState(false);
  const [form, setForm] = useState<GoalFormState>(() => buildInitialForm('EMERGENCY'));

  const load = useCallback(async () => {
    try {
      const [goalsData, setupData, categoriesData, summaryData] = await Promise.all([
        apiRequest<GoalsResponse>('/api/goals'),
        apiRequest<GoalSetupDataResponse>('/api/goals/setup-data'),
        apiRequest<CategoriesResponse>('/api/categories'),
        apiRequest<GoalSummaryResponse>('/api/goals/summary', { method: 'POST' }),
      ]);
      setGoals(goalsData.goals ?? []);
      setDebtAccounts(setupData.debtAccounts ?? []);
      setLiquidCash(setupData.liquidCash ?? 0);
      setCategoryOptions(categoriesData.categories ?? []);
      setSummary(summaryData);
      setError(null);
    } catch (err) {
      const message =
        typeof err === 'object' && err && 'error' in err
          ? String((err as { error?: string }).error)
          : 'Unable to load goals.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const activeGoals = useMemo(
    () => goals.filter((goal) => goal.status !== 'COMPLETED'),
    [goals]
  );
  const completedGoals = useMemo(
    () => goals.filter((goal) => goal.status === 'COMPLETED'),
    [goals]
  );

  const selectedTemplate = useMemo(
    () => GOAL_TEMPLATES.find((option) => option.id === form.templateId) ?? GOAL_TEMPLATES[0],
    [form.templateId]
  );

  const linkedDebtAccount = useMemo(
    () => debtAccounts.find((account) => account.id === form.accountId) ?? null,
    [debtAccounts, form.accountId]
  );

  const updateForm = (patch: Partial<GoalFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const selectTemplate = (templateId: GoalTemplateId) => {
    setForm((prev) => {
      const next = buildInitialForm(templateId);
      const debtDefaults =
        templateId === 'DEBT'
          ? {
              accountId: prev.accountId,
            }
          : {};
      return { ...next, ...debtDefaults };
    });
    setError(null);
  };

  const openCreate = (templateId: GoalTemplateId = 'EMERGENCY') => {
    setForm(buildInitialForm(templateId));
    setCreateOpen(true);
    setError(null);
  };

  const handleDebtAccountChange = (accountId: string) => {
    const account = debtAccounts.find((item) => item.id === accountId);
    updateForm({
      accountId,
      target: account ? String(Math.round(account.balance)) : '',
      minPayment:
        account?.estimatedPayment && account.estimatedPayment > 0
          ? String(Math.round(account.estimatedPayment))
          : form.minPayment,
    });
  };

  const validateForm = () => {
    if (!form.name.trim()) return 'Enter a goal name.';
    const target = Number(form.target);
    if (!Number.isFinite(target) || target <= 0) return 'Enter a valid target.';
    if (!form.endDate.trim()) return 'Add a target date.';
    if (selectedTemplate.id === 'DEBT' && !form.minPayment.trim()) {
      return 'Add the minimum payment for this debt goal.';
    }
    return null;
  };

  const saveGoal = async () => {
    const validation = validateForm();
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    try {
      await apiRequest('/api/goals', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          type: selectedTemplate.type,
          cadence: 'MONTHLY',
          target: Number(form.target),
          startDate: todayISO(),
          endDate: form.endDate.trim(),
          priority: goals.length + 1,
          category:
            selectedTemplate.type === 'SPEND_LIMIT' && form.category.trim()
              ? form.category.trim()
              : null,
          accountId:
            selectedTemplate.id === 'DEBT' && form.accountId !== 'manual'
              ? form.accountId
              : null,
          minPayment:
            selectedTemplate.id === 'DEBT' && form.minPayment.trim()
              ? Number(form.minPayment)
              : null,
          interestRate:
            selectedTemplate.id === 'DEBT' && form.interestRate.trim()
              ? Number(form.interestRate)
              : null,
          termMonths:
            selectedTemplate.id === 'DEBT' && form.termMonths.trim()
              ? Number(form.termMonths)
              : null,
        },
      });
      setCreateOpen(false);
      setForm(buildInitialForm('EMERGENCY'));
      await load();
    } catch (err) {
      const message =
        typeof err === 'object' && err && 'error' in err
          ? String((err as { error?: string }).error)
          : 'Unable to save goal.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const deleteGoal = async (goalId: string) => {
    setError(null);
    try {
      await apiRequest('/api/goals', {
        method: 'DELETE',
        body: { goalId },
      });
      if (selectedInsightGoal === goalId) {
        setInsightOpen(false);
        setSelectedInsightGoal(null);
        setInsightText('');
      }
      await load();
    } catch (err) {
      const message =
        typeof err === 'object' && err && 'error' in err
          ? String((err as { error?: string }).error)
          : 'Unable to delete goal.';
      setError(message);
    }
  };

  const loadInsight = async (goalId: string) => {
    setInsightOpen(true);
    setSelectedInsightGoal(goalId);
    setInsightText('');
    setInsightLoading(true);
    try {
      const response = await apiRequest<{ insight?: string }>('/api/goals/insights', {
        method: 'POST',
        body: { goalId },
      });
      setInsightText(response.insight ?? 'No guidance available yet.');
    } catch (err) {
      const message =
        typeof err === 'object' && err && 'error' in err
          ? String((err as { error?: string }).error)
          : 'Unable to generate a goal plan right now.';
      setInsightText(message);
    } finally {
      setInsightLoading(false);
    }
  };

  const summaryAccent = useMemo(() => {
    if (!summary) return colors.primary;
    if (summary.status === 'on_track') return colors.success;
    if (summary.status === 'off_track') return colors.danger;
    return colors.accent;
  }, [summary]);

  return (
    <Screen title="Goals" subtitle="Create targets and track progress from live account activity." edgeToEdge>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.eyebrow}>Monthly status</Text>
              <Text style={styles.summaryTitle}>Goal progress</Text>
            </View>
            <Pressable style={styles.summaryButton} onPress={() => openCreate()}>
              <Text style={styles.summaryButtonLabel}>New goal</Text>
            </Pressable>
          </View>
          <View style={[styles.statusPill, { borderColor: summaryAccent }]}>
            <Text style={[styles.statusPillText, { color: summaryAccent }]}>
              {(summary?.status ?? 'on_track').replace('_', ' ')}
            </Text>
          </View>
          <Text style={styles.summaryBody}>
            {summary?.summary ??
              'Set a goal to see whether your month is supporting savings, debt payoff, or spending limits.'}
          </Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Active goals</Text>
              <Text style={styles.summaryStatValue}>{activeGoals.length}</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Cash on hand</Text>
              <Text style={styles.summaryStatValue}>{formatCurrency(liquidCash)}</Text>
            </View>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.templateRow}
        >
          {GOAL_TEMPLATES.map((template) => (
            <Pressable key={template.id} style={styles.templateCard} onPress={() => openCreate(template.id)}>
              <Text style={styles.templateLabel}>{template.label}</Text>
              <Text style={styles.templateDescription}>{template.description}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading goals...</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!loading && activeGoals.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No active goals yet</Text>
            <Text style={styles.emptyBody}>
              Start with an emergency fund, debt payoff, or savings target. LEDGR will track progress from linked data.
            </Text>
          </View>
        ) : null}

        {activeGoals.map((goal) => {
          const progressRaw = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
          const progress = Math.min(100, Math.max(0, progressRaw));
          const trackColor =
            goal.type === 'SPEND_LIMIT' && progressRaw > 100 ? colors.danger : colors.primary;
          const isDebt = goal.type === 'DEBT';
          return (
            <View key={goal.id} style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <View style={styles.goalHeaderCopy}>
                  <Text style={styles.goalName}>{goal.name}</Text>
                  <Text style={styles.goalMeta}>
                    {goalTypeLabel(goal.type)} · {goal.cadence.toLowerCase()}
                    {goal.category ? ` · ${goal.category}` : ''}
                  </Text>
                </View>
                <Text style={styles.goalTarget}>{formatGoalValue(goal, goal.target)}</Text>
              </View>

              <View style={styles.goalProgressRow}>
                <Text style={styles.goalCurrent}>{formatGoalValue(goal, goal.current)}</Text>
                <Text style={styles.goalProgressText}>{progress.toFixed(0)}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: trackColor }]} />
              </View>

              <View style={styles.goalDetails}>
                <Text style={styles.goalDetailItem}>Target date: {formatDateLabel(goal.endDate)}</Text>
                {goal.type === 'DEBT' && goal.minPayment ? (
                  <Text style={styles.goalDetailItem}>Min payment: {formatCurrency(goal.minPayment)}</Text>
                ) : null}
              </View>

              <View style={styles.goalActions}>
                {isDebt ? (
                  <Pressable style={styles.secondaryButton} onPress={() => loadInsight(goal.id)}>
                    <Text style={styles.secondaryLabel}>Plan</Text>
                  </Pressable>
                ) : null}
                <Pressable style={styles.secondaryButton} onPress={() => deleteGoal(goal.id)}>
                  <Text style={styles.secondaryLabel}>Delete</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {completedGoals.length > 0 ? (
          <View style={styles.completedSection}>
            <Text style={styles.completedTitle}>Completed</Text>
            {completedGoals.map((goal) => (
              <View key={goal.id} style={styles.completedRow}>
                <View style={styles.completedCopy}>
                  <Text style={styles.completedName}>{goal.name}</Text>
                  <Text style={styles.completedMeta}>{goalTypeLabel(goal.type)}</Text>
                </View>
                <Text style={styles.completedAmount}>{formatGoalValue(goal, goal.target)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Pressable
          style={styles.refreshButton}
          onPress={() => {
            setRefreshing(true);
            void load();
          }}
          disabled={refreshing}
        >
          <Text style={styles.refreshButtonLabel}>{refreshing ? 'Refreshing...' : 'Refresh goals'}</Text>
        </Pressable>
      </ScrollView>

      <ModalSheet visible={createOpen} onClose={() => setCreateOpen(false)}>
        <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.sheetTitle}>New goal</Text>
          <Text style={styles.sheetBody}>
            Like Copilot, this starts with a clear target and date. LEDGR also ties progress to your live data.
          </Text>

          <Text style={styles.sheetSection}>Goal type</Text>
          <View style={styles.chipWrap}>
            {GOAL_TEMPLATES.map((template) => (
              <Chip
                key={template.id}
                label={template.label}
                active={form.templateId === template.id}
                onPress={() => selectTemplate(template.id)}
              />
            ))}
          </View>

          <Text style={styles.sheetSection}>Name</Text>
          <TextInput
            value={form.name}
            onChangeText={(value) => updateForm({ name: value })}
            placeholder="Goal name"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />

          <Text style={styles.sheetSection}>
            {selectedTemplate.type === 'BUFFER_DAYS' ? 'Target days' : 'Target amount'}
          </Text>
          <TextInput
            value={form.target}
            onChangeText={(value) => updateForm({ target: sanitizeNumericInput(value) })}
            placeholder={selectedTemplate.type === 'BUFFER_DAYS' ? '30' : '5000'}
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            style={styles.input}
            editable={!(selectedTemplate.id === 'DEBT' && form.accountId !== 'manual')}
          />
          {selectedTemplate.id === 'EMERGENCY' ? (
            <Text style={styles.helperText}>
              Current liquid cash on hand: {formatCurrency(liquidCash)}.
            </Text>
          ) : null}

          <Text style={styles.sheetSection}>Target date</Text>
          <TextInput
            value={form.endDate}
            onChangeText={(value) => updateForm({ endDate: value })}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            style={styles.input}
          />

          {selectedTemplate.type === 'SPEND_LIMIT' ? (
            <>
              <Text style={styles.sheetSection}>Category</Text>
              <TextInput
                value={form.category}
                onChangeText={(value) => updateForm({ category: value })}
                placeholder="Dining, Groceries, Travel..."
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              {categoryOptions.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryScroll}
                  keyboardShouldPersistTaps="handled"
                >
                  {categoryOptions.map((category) => (
                    <View key={category}>
                      <Chip
                        label={category}
                        active={form.category.trim().toLowerCase() === category.toLowerCase()}
                        onPress={() => updateForm({ category })}
                      />
                    </View>
                  ))}
                </ScrollView>
              ) : null}
            </>
          ) : null}

          {selectedTemplate.id === 'DEBT' ? (
            <>
              <Text style={styles.sheetSection}>Debt account</Text>
              <View style={styles.chipWrap}>
                <Chip
                  label="Manual entry"
                  active={form.accountId === 'manual'}
                  onPress={() => handleDebtAccountChange('manual')}
                />
                {debtAccounts.map((account) => (
                  <Chip
                    key={account.id}
                    label={`${account.name}${account.mask ? ` •${account.mask}` : ''}`}
                    active={form.accountId === account.id}
                    onPress={() => handleDebtAccountChange(account.id)}
                  />
                ))}
              </View>
              {linkedDebtAccount ? (
                <Text style={styles.helperText}>
                  Current balance {formatCurrency(linkedDebtAccount.balance)}
                  {linkedDebtAccount.estimatedPayment
                    ? ` · est. payment ${formatCurrency(linkedDebtAccount.estimatedPayment)}`
                    : ''}
                </Text>
              ) : null}

              <Text style={styles.sheetSection}>Minimum payment</Text>
              <TextInput
                value={form.minPayment}
                onChangeText={(value) => updateForm({ minPayment: sanitizeNumericInput(value) })}
                placeholder="150"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                style={styles.input}
              />

              <Text style={styles.sheetSection}>Interest rate (optional)</Text>
              <TextInput
                value={form.interestRate}
                onChangeText={(value) => updateForm({ interestRate: sanitizeNumericInput(value) })}
                placeholder="22.9"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                style={styles.input}
              />

              <Text style={styles.sheetSection}>Loan term months (optional)</Text>
              <TextInput
                value={form.termMonths}
                onChangeText={(value) => updateForm({ termMonths: value.replace(/[^0-9]/g, '') })}
                placeholder="36"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                style={styles.input}
              />
            </>
          ) : null}

          <View style={styles.sheetActions}>
            <Pressable style={styles.secondaryButton} onPress={() => setCreateOpen(false)}>
              <Text style={styles.secondaryLabel}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={saveGoal} disabled={saving}>
              <Text style={styles.primaryLabel}>{saving ? 'Saving...' : 'Create goal'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </ModalSheet>

      <ModalSheet visible={insightOpen} onClose={() => setInsightOpen(false)}>
        <ScrollView contentContainerStyle={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Goal plan</Text>
          {insightLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>Building plan...</Text>
            </View>
          ) : (
            <Text style={styles.insightBody}>{insightText}</Text>
          )}
        </ScrollView>
      </ModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 14,
  },
  summaryCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(18, 24, 46, 0.45)',
    padding: 18,
    gap: 12,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4,
  },
  summaryButton: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.primary,
  },
  summaryButtonLabel: {
    color: colors.background,
    fontWeight: '700',
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  summaryBody: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  summaryStats: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryStat: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(9, 13, 27, 0.45)',
    padding: 12,
  },
  summaryStatLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryStatValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
  },
  templateRow: {
    gap: 10,
    paddingRight: 20,
  },
  templateCard: {
    width: 190,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 14,
    gap: 8,
  },
  templateLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  templateDescription: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
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
    borderRadius: 24,
    padding: 18,
    backgroundColor: 'rgba(18, 24, 46, 0.35)',
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  goalCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(9, 13, 27, 0.55)',
    padding: 16,
    gap: 12,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  goalHeaderCopy: {
    flex: 1,
  },
  goalName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  goalMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  goalTarget: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  goalProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalCurrent: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  goalProgressText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.progressTrack,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  goalDetails: {
    gap: 4,
  },
  goalDetailItem: {
    color: colors.textMuted,
    fontSize: 12,
  },
  goalActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  completedSection: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 14,
    gap: 10,
  },
  completedTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
    paddingTop: 10,
  },
  completedCopy: {
    flex: 1,
    marginRight: 12,
  },
  completedName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  completedMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  completedAmount: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  refreshButton: {
    alignSelf: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  refreshButtonLabel: {
    color: colors.text,
    fontWeight: '600',
  },
  sheetContent: {
    gap: 12,
    paddingBottom: 18,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sheetBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  sheetSection: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  helperText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  categoryScroll: {
    gap: 8,
    paddingRight: 6,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  primaryLabel: {
    color: colors.background,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  secondaryLabel: {
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  insightBody: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
});
