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

type Goal = {
  id: string;
  name: string;
  type: string;
  cadence: string;
  current: number;
  target: number;
  category?: string | null;
  accountId?: string | null;
  minPayment?: number | null;
  interestRate?: number | null;
  termMonths?: number | null;
  status?: string | null;
  completedAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

type GoalsResponse = {
  goals: Goal[];
};

type SetupDataResponse = {
  debtAccounts: Array<{
    id: string;
    name: string;
    institutionName?: string | null;
    mask?: string | null;
    balance: number;
    estimatedPayment?: number | null;
  }>;
  hasExistingGoals: boolean;
  liquidCash: number;
};

type InsightResponse = {
  insight?: string;
  error?: string;
};

const goalTypeOptions = [
  { value: 'SAVINGS', label: 'Savings target' },
  { value: 'SPEND_LIMIT', label: 'Spending limit' },
  { value: 'INCOME_TARGET', label: 'Income target' },
  { value: 'DEBT', label: 'Debt payoff' },
  { value: 'BUFFER_DAYS', label: 'Buffer days' },
];

const cadenceOptions = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Biweekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'CUSTOM', label: 'Custom' },
];

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

const todayISO = () => new Date().toISOString().slice(0, 10);

export function GoalsScreen() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<Record<string, string>>({});
  const [insightLoading, setInsightLoading] = useState<Record<string, boolean>>({});

  const [editOpen, setEditOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editName, setEditName] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editMinPayment, setEditMinPayment] = useState('');
  const [editInterestRate, setEditInterestRate] = useState('');
  const [editTermMonths, setEditTermMonths] = useState('');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE');

  const [setupOpen, setSetupOpen] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const [setupData, setSetupData] = useState<SetupDataResponse | null>(null);
  const [selectedGoals, setSelectedGoals] = useState<Array<'DEBT' | 'EMERGENCY' | 'SAVINGS'>>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [setupDetails, setSetupDetails] = useState<Record<string, any>>({
    DEBT: {
      name: 'Debt payoff',
      target: '',
      startDate: todayISO(),
      endDate: '',
      accountId: 'manual',
      minPayment: '',
      interestRate: '',
      termMonths: '',
    },
    EMERGENCY: {
      name: 'Emergency fund',
      target: '',
      startDate: todayISO(),
      endDate: '',
      complete: false,
    },
    SAVINGS: {
      name: 'Savings goal',
      target: '',
      startDate: todayISO(),
      endDate: '',
    },
  });

  const loadGoals = async () => {
    try {
      const data = await apiRequest<GoalsResponse>('/api/goals');
      setGoals(data.goals ?? []);
      setError(null);
    } catch (err) {
      const message =
        typeof err === 'object' && err && 'error' in err
          ? String((err as { error?: string }).error)
          : 'Unable to load goals.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadSetupData = async () => {
    const data = await apiRequest<SetupDataResponse>('/api/goals/setup-data');
    setSetupData(data);
    setReplaceExisting(data.hasExistingGoals);
  };

  useEffect(() => {
    loadGoals();
  }, []);

  const activeGoals = useMemo(
    () => goals.filter((goal) => goal.status !== 'COMPLETED'),
    [goals]
  );
  const completedGoals = useMemo(
    () => goals.filter((goal) => goal.status === 'COMPLETED'),
    [goals]
  );

  const openEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setEditName(goal.name);
    setEditTarget(String(goal.target));
    setEditEndDate(goal.endDate ? goal.endDate.slice(0, 10) : '');
    setEditMinPayment(goal.minPayment ? String(goal.minPayment) : '');
    setEditInterestRate(goal.interestRate ? String(goal.interestRate) : '');
    setEditTermMonths(goal.termMonths ? String(goal.termMonths) : '');
    setEditStatus((goal.status as 'ACTIVE' | 'COMPLETED') ?? 'ACTIVE');
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editingGoal) return;
    await apiRequest('/api/goals', {
      method: 'PATCH',
      body: {
        goalId: editingGoal.id,
        name: editName,
        target: Number(editTarget),
        endDate: editEndDate || null,
        minPayment: editMinPayment ? Number(editMinPayment) : null,
        interestRate: editInterestRate ? Number(editInterestRate) : null,
        termMonths: editTermMonths ? Number(editTermMonths) : null,
        status: editStatus,
      },
    });
    setEditOpen(false);
    setEditingGoal(null);
    await loadGoals();
  };

  const deleteGoal = async (goalId: string) => {
    await apiRequest('/api/goals', {
      method: 'DELETE',
      body: { goalId },
    });
    await loadGoals();
  };

  const fetchInsight = async (goalId: string) => {
    setInsightLoading((prev) => ({ ...prev, [goalId]: true }));
    try {
      const data = await apiRequest<InsightResponse>('/api/goals/insights', {
        method: 'POST',
        body: { goalId },
      });
      setInsights((prev) => ({ ...prev, [goalId]: data.insight ?? 'No insight returned.' }));
    } finally {
      setInsightLoading((prev) => ({ ...prev, [goalId]: false }));
    }
  };

  const toggleGoal = (key: 'DEBT' | 'EMERGENCY' | 'SAVINGS') => {
    setSelectedGoals((prev) => {
      if (prev.includes(key)) return prev.filter((item) => item !== key);
      if (prev.length >= 3) return prev;
      return [...prev, key];
    });
  };

  const updateSetupDetails = (key: string, patch: Record<string, any>) => {
    setSetupDetails((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  };

  const handleSetupSubmit = async () => {
    if (selectedGoals.length === 0) return;
    if (replaceExisting) {
      await apiRequest('/api/goals', {
        method: 'DELETE',
        body: { reset: true },
      });
    }
    for (let index = 0; index < selectedGoals.length; index += 1) {
      const key = selectedGoals[index];
      const info = setupDetails[key];
      const type = key === 'DEBT' ? 'DEBT' : 'SAVINGS';
      await apiRequest('/api/goals', {
        method: 'POST',
        body: {
          name: info.name,
          type,
          cadence: 'MONTHLY',
          target: Number(info.target),
          startDate: info.startDate || null,
          endDate: info.complete ? todayISO() : info.endDate || null,
          priority: index + 1,
          accountId: key === 'DEBT' && info.accountId !== 'manual' ? info.accountId : null,
          minPayment: key === 'DEBT' && info.minPayment ? Number(info.minPayment) : null,
          interestRate: key === 'DEBT' && info.interestRate ? Number(info.interestRate) : null,
          termMonths: key === 'DEBT' && info.termMonths ? Number(info.termMonths) : null,
          status: info.complete ? 'COMPLETED' : 'ACTIVE',
        },
      });
    }
    setSetupOpen(false);
    setSetupStep(1);
    setSelectedGoals([]);
    await loadGoals();
  };

  return (
    <Screen edgeToEdge>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable
            style={styles.primaryButton}
            onPress={async () => {
              await loadSetupData();
              setSetupOpen(true);
            }}
          >
            <Text style={styles.primaryLabel}>Start goal setup</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={loadGoals}>
            <Text style={styles.secondaryLabel}>Refresh</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading goals...</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Active goals</Text>
          {activeGoals.length === 0 ? (
            <Text style={styles.emptyText}>No active goals yet.</Text>
          ) : (
            activeGoals.map((goal) => {
              const progress = goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0;
              return (
                <View key={goal.id} style={styles.goalCard}>
                  <View style={styles.goalHeader}>
                    <View>
                      <Text style={styles.goalName}>{goal.name}</Text>
                      <Text style={styles.goalMeta}>
                        {goalTypeOptions.find((opt) => opt.value === goal.type)?.label ?? goal.type} ·{' '}
                        {cadenceOptions.find((opt) => opt.value === goal.cadence)?.label ?? goal.cadence}
                      </Text>
                    </View>
                    <Text style={styles.goalValue}>
                      {formatCurrency(goal.current)} / {formatCurrency(goal.target)}
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
                  </View>
                  <View style={styles.goalActions}>
                    <Pressable style={styles.chipButton} onPress={() => openEdit(goal)}>
                      <Text style={styles.chipLabel}>Edit</Text>
                    </Pressable>
                    <Pressable style={styles.chipButton} onPress={() => deleteGoal(goal.id)}>
                      <Text style={[styles.chipLabel, styles.dangerLabel]}>Delete</Text>
                    </Pressable>
                    <Pressable style={styles.chipButton} onPress={() => fetchInsight(goal.id)}>
                      <Text style={styles.chipLabel}>
                        {insightLoading[goal.id] ? 'Thinking...' : 'Get insight'}
                      </Text>
                    </Pressable>
                  </View>
                  {insights[goal.id] ? (
                    <Text style={styles.insightText}>{insights[goal.id]}</Text>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Completed goals</Text>
          {completedGoals.length === 0 ? (
            <Text style={styles.emptyText}>No completed goals yet.</Text>
          ) : (
            completedGoals.map((goal) => (
              <View key={goal.id} style={styles.goalCard}>
                <Text style={styles.goalName}>{goal.name}</Text>
                <Text style={styles.goalMeta}>
                  Completed {goal.completedAt ? new Date(goal.completedAt).toLocaleDateString() : ''}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <ModalSheet visible={editOpen} onClose={() => setEditOpen(false)}>
        <Text style={styles.modalTitle}>Edit goal</Text>
        <TextInput value={editName} onChangeText={setEditName} style={styles.input} placeholder="Goal name" placeholderTextColor={colors.textMuted} />
        <TextInput value={editTarget} onChangeText={setEditTarget} style={styles.input} keyboardType="numeric" placeholder="Target" placeholderTextColor={colors.textMuted} />
        <TextInput value={editEndDate} onChangeText={setEditEndDate} style={styles.input} placeholder="Target date (YYYY-MM-DD)" placeholderTextColor={colors.textMuted} />
        <TextInput value={editMinPayment} onChangeText={setEditMinPayment} style={styles.input} keyboardType="numeric" placeholder="Min payment" placeholderTextColor={colors.textMuted} />
        <TextInput value={editInterestRate} onChangeText={setEditInterestRate} style={styles.input} keyboardType="numeric" placeholder="Interest rate" placeholderTextColor={colors.textMuted} />
        <TextInput value={editTermMonths} onChangeText={setEditTermMonths} style={styles.input} keyboardType="numeric" placeholder="Term months" placeholderTextColor={colors.textMuted} />
        <Pressable style={styles.toggleButton} onPress={() => setEditStatus((prev) => (prev === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE'))}>
          <Text style={styles.toggleLabel}>{editStatus === 'COMPLETED' ? 'Mark active' : 'Mark completed'}</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={saveEdit}>
          <Text style={styles.primaryLabel}>Save</Text>
        </Pressable>
      </ModalSheet>

      <ModalSheet visible={setupOpen} onClose={() => setSetupOpen(false)}>
        <ScrollView contentContainerStyle={styles.setupContent}>
          <Text style={styles.modalTitle}>Goal setup</Text>
          <Text style={styles.sectionSubtitle}>Step {setupStep} of 3</Text>

          {setupStep === 1 ? (
            <View style={styles.setupBlock}>
              <Text style={styles.sectionTitle}>Choose up to 3 goals</Text>
              {(['DEBT', 'EMERGENCY', 'SAVINGS'] as const).map((key) => (
                <Pressable key={key} style={styles.goalOption} onPress={() => toggleGoal(key)}>
                  <Text style={styles.goalName}>{key}</Text>
                  <Text style={styles.goalMeta}>{selectedGoals.includes(key) ? 'Selected' : 'Tap to select'}</Text>
                </Pressable>
              ))}
              <Pressable style={styles.primaryButton} onPress={() => setSetupStep(2)}>
                <Text style={styles.primaryLabel}>Next</Text>
              </Pressable>
            </View>
          ) : null}

          {setupStep === 2 ? (
            <View style={styles.setupBlock}>
              {selectedGoals.map((key) => (
                <View key={key} style={styles.goalCard}>
                  <Text style={styles.goalName}>{key} details</Text>
                  <TextInput
                    value={setupDetails[key].name}
                    onChangeText={(value) => updateSetupDetails(key, { name: value })}
                    style={styles.input}
                    placeholder="Goal name"
                    placeholderTextColor={colors.textMuted}
                  />
                  <TextInput
                    value={setupDetails[key].target}
                    onChangeText={(value) => updateSetupDetails(key, { target: value })}
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="Target"
                    placeholderTextColor={colors.textMuted}
                  />
                  {key === 'DEBT' && setupData?.debtAccounts?.length ? (
                    <View style={styles.setupBlock}>
                      <Text style={styles.goalMeta}>Debt account</Text>
                      {setupData.debtAccounts.map((account) => (
                        <Pressable
                          key={account.id}
                          style={styles.goalOption}
                          onPress={() => {
                            updateSetupDetails(key, {
                              accountId: account.id,
                              target: String(Math.round(account.balance)),
                              minPayment: account.estimatedPayment
                                ? String(Math.round(account.estimatedPayment))
                                : setupDetails[key].minPayment,
                            });
                          }}
                        >
                          <Text style={styles.goalName}>{account.name}</Text>
                          <Text style={styles.goalMeta}>
                            Balance {formatCurrency(account.balance)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  {key === 'DEBT' ? (
                    <>
                      <TextInput
                        value={setupDetails[key].minPayment}
                        onChangeText={(value) => updateSetupDetails(key, { minPayment: value })}
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="Minimum payment"
                        placeholderTextColor={colors.textMuted}
                      />
                      <TextInput
                        value={setupDetails[key].interestRate}
                        onChangeText={(value) => updateSetupDetails(key, { interestRate: value })}
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="Interest rate"
                        placeholderTextColor={colors.textMuted}
                      />
                      <TextInput
                        value={setupDetails[key].termMonths}
                        onChangeText={(value) => updateSetupDetails(key, { termMonths: value })}
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="Term months"
                        placeholderTextColor={colors.textMuted}
                      />
                    </>
                  ) : null}
                  {key === 'EMERGENCY' ? (
                    <Pressable
                      style={styles.toggleButton}
                      onPress={() =>
                        updateSetupDetails(key, { complete: !setupDetails[key].complete })
                      }
                    >
                      <Text style={styles.toggleLabel}>
                        {setupDetails[key].complete
                          ? 'Mark as completed ✓'
                          : 'Already completed?'}
                      </Text>
                    </Pressable>
                  ) : null}
                  <TextInput
                    value={setupDetails[key].endDate}
                    onChangeText={(value) => updateSetupDetails(key, { endDate: value })}
                    style={styles.input}
                    placeholder="Target date (YYYY-MM-DD)"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              ))}
              <Pressable style={styles.primaryButton} onPress={() => setSetupStep(3)}>
                <Text style={styles.primaryLabel}>Review</Text>
              </Pressable>
            </View>
          ) : null}

          {setupStep === 3 ? (
            <View style={styles.setupBlock}>
              <Text style={styles.sectionTitle}>Review goals</Text>
              {selectedGoals.map((key, index) => (
                <View key={key} style={styles.goalCard}>
                  <Text style={styles.goalName}>{index + 1}. {setupDetails[key].name}</Text>
                  <Text style={styles.goalMeta}>Target {setupDetails[key].target}</Text>
                </View>
              ))}
              {setupData?.hasExistingGoals ? (
                <Pressable style={styles.toggleButton} onPress={() => setReplaceExisting((prev) => !prev)}>
                  <Text style={styles.toggleLabel}>
                    {replaceExisting ? 'Replace existing goals ✓' : 'Replace existing goals'}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.primaryButton} onPress={handleSetupSubmit}>
                <Text style={styles.primaryLabel}>Create goals</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </ModalSheet>
    </Screen>
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
    gap: 10,
  },
  primaryButton: {
    flex: 1,
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
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  secondaryLabel: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 12,
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
  sectionCard: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingVertical: 2,
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
  goalCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    gap: 8,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  goalName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  goalMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  goalValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrack: {
    height: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
  },
  goalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipButton: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipLabel: {
    color: colors.text,
    fontSize: 11,
  },
  dangerLabel: {
    color: colors.danger,
  },
  insightText: {
    color: colors.textMuted,
    fontSize: 12,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  toggleLabel: {
    color: colors.text,
    fontSize: 12,
  },
  setupContent: {
    gap: 12,
  },
  setupBlock: {
    gap: 12,
  },
  goalOption: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});
