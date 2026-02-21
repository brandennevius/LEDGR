import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type AppTabName =
  | 'Dashboard'
  | 'Transactions'
  | 'Categories'
  | 'Distribution'
  | 'Goals'
  | 'Accounts';

export type OnboardingStep = {
  id: string;
  tab: AppTabName;
  title: string;
  body: string;
  anchorId?: string;
  nextLabel?: string;
};

export type OnboardingAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const ONBOARDING_STORAGE_PREFIX = 'onboarding.v1.completed';

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'dashboard-overview',
    tab: 'Dashboard',
    title: 'Dashboard',
    body: 'This is your command center for spend, income, budget pace, and transactions that need review.',
  },
  {
    id: 'transactions-overview',
    tab: 'Transactions',
    title: 'Transactions',
    body: 'Review recent transactions, filter quickly, and edit categories or splits in detail.',
  },
  {
    id: 'categories-overview',
    tab: 'Categories',
    title: 'Categories',
    body: 'Manage category budgets, group categories, and inspect where your spending is concentrated.',
  },
  {
    id: 'cashflow-overview',
    tab: 'Distribution',
    title: 'Cash flow',
    body: 'See how inflows and outflows distribute across your categories and spending patterns.',
  },
  {
    id: 'goals-overview',
    tab: 'Goals',
    title: 'Goals',
    body: 'Create and track goals like debt payoff, emergency fund targets, and savings milestones.',
  },
  {
    id: 'accounts-overview',
    tab: 'Accounts',
    title: 'Accounts',
    body: 'This page shows your linked institutions, sync status, and connected accounts.',
  },
  {
    id: 'accounts-connect',
    tab: 'Accounts',
    title: 'Final step: connect your account',
    body: 'Tap Connect to link your first institution and start transaction syncing.',
    anchorId: 'accounts-connect',
    nextLabel: 'Finish',
  },
];

type AppOnboardingContextValue = {
  loading: boolean;
  active: boolean;
  currentStep: OnboardingStep | null;
  stepIndex: number;
  totalSteps: number;
  anchors: Record<string, OnboardingAnchor>;
  registerAnchor: (id: string, anchor: OnboardingAnchor) => void;
  unregisterAnchor: (id: string) => void;
  next: () => Promise<void>;
  skip: () => Promise<void>;
  restart: () => Promise<void>;
};

const AppOnboardingContext = createContext<AppOnboardingContextValue | null>(null);

const buildStorageKey = (userId: string) => `${ONBOARDING_STORAGE_PREFIX}:${userId}`;

export function AppOnboardingProvider({
  userId,
  navigateToTab,
  children,
}: {
  userId: string;
  navigateToTab: (tab: AppTabName) => void;
  children: ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [anchors, setAnchors] = useState<Record<string, OnboardingAnchor>>({});

  const persistCompletion = useCallback(
    async (completed: boolean) => {
      const key = buildStorageKey(userId);
      if (completed) {
        await AsyncStorage.setItem(key, 'true');
        return;
      }
      await AsyncStorage.removeItem(key);
    },
    [userId]
  );

  useEffect(() => {
    let mounted = true;

    const loadStatus = async () => {
      setLoading(true);
      try {
        const done = await AsyncStorage.getItem(buildStorageKey(userId));
        if (!mounted) return;
        setActive(done !== 'true');
        setStepIndex(0);
      } catch {
        if (!mounted) return;
        setActive(true);
        setStepIndex(0);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadStatus();
    return () => {
      mounted = false;
    };
  }, [userId]);

  const currentStep = active ? ONBOARDING_STEPS[stepIndex] ?? null : null;

  useEffect(() => {
    if (loading || !active || !currentStep) return;
    navigateToTab(currentStep.tab);
  }, [active, currentStep, loading, navigateToTab]);

  const registerAnchor = useCallback((id: string, anchor: OnboardingAnchor) => {
    setAnchors((prev) => {
      const existing = prev[id];
      if (
        existing &&
        existing.x === anchor.x &&
        existing.y === anchor.y &&
        existing.width === anchor.width &&
        existing.height === anchor.height
      ) {
        return prev;
      }
      return { ...prev, [id]: anchor };
    });
  }, []);

  const unregisterAnchor = useCallback((id: string) => {
    setAnchors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const complete = useCallback(async () => {
    setActive(false);
    setStepIndex(0);
    await persistCompletion(true);
  }, [persistCompletion]);

  const next = useCallback(async () => {
    if (!active) return;
    if (stepIndex >= ONBOARDING_STEPS.length - 1) {
      await complete();
      return;
    }
    setStepIndex((prev) => prev + 1);
  }, [active, complete, stepIndex]);

  const skip = useCallback(async () => {
    await complete();
  }, [complete]);

  const restart = useCallback(async () => {
    await persistCompletion(false);
    setStepIndex(0);
    setActive(true);
  }, [persistCompletion]);

  const value = useMemo<AppOnboardingContextValue>(
    () => ({
      loading,
      active,
      currentStep,
      stepIndex,
      totalSteps: ONBOARDING_STEPS.length,
      anchors,
      registerAnchor,
      unregisterAnchor,
      next,
      skip,
      restart,
    }),
    [
      loading,
      active,
      currentStep,
      stepIndex,
      anchors,
      registerAnchor,
      unregisterAnchor,
      next,
      skip,
      restart,
    ]
  );

  return <AppOnboardingContext.Provider value={value}>{children}</AppOnboardingContext.Provider>;
}

export function useAppOnboarding() {
  const context = useContext(AppOnboardingContext);
  if (!context) {
    throw new Error('useAppOnboarding must be used within AppOnboardingProvider');
  }
  return context;
}
