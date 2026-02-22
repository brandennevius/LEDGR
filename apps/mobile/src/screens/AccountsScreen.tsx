import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  create as createPlaidLink,
  destroy as destroyPlaidLink,
  open as openPlaidLink,
  type LinkExit,
  type LinkSuccess,
} from 'react-native-plaid-link-sdk';

import { Screen } from '../components/Screen';
import { useAppOnboarding } from '../context/AppOnboardingContext';
import { apiRequest } from '../lib/api';
import { colors } from '../theme';

type Account = {
  id: string;
  name: string;
  type: string;
  mask?: string;
  institutionName?: string;
  balance: number;
};

type OverviewResponse = {
  clientName: string;
  accounts: Account[];
  plaidItems?: Array<{ id: string }>;
};

type LinkTokenResponse = { link_token: string };

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

export function AccountsScreen() {
  const connectButtonRef = useRef<View | null>(null);
  const { registerAnchor, unregisterAnchor } = useAppOnboarding();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [connectionCount, setConnectionCount] = useState(0);
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (typeof err === 'object' && err !== null) {
      const maybe = err as { error?: unknown; plaid?: unknown };
      const apiError =
        typeof maybe.error === 'string' && maybe.error.length > 0 ? maybe.error : null;
      const plaidError =
        typeof maybe.plaid === 'object' && maybe.plaid !== null
          ? JSON.stringify(maybe.plaid)
          : null;
      if (apiError && plaidError) return `${apiError}: ${plaidError}`;
      if (apiError) return apiError;
    }
    return fallback;
  };

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<OverviewResponse>('/api/client/overview');
      setAccounts(data.accounts ?? []);
      setConnectionCount(data.plaidItems?.length ?? 0);
      setClientName(data.clientName ?? '');
      setError(null);
    } catch (err) {
      const message =
        typeof err === 'object' && err && 'error' in err
          ? String((err as { error?: string }).error)
          : 'Unable to load accounts.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const measureConnectButton = useCallback(() => {
    requestAnimationFrame(() => {
      connectButtonRef.current?.measureInWindow((x, y, width, height) => {
        if (width <= 0 || height <= 0) return;
        registerAnchor('accounts-connect', { x, y, width, height });
      });
    });
  }, [registerAnchor]);

  useEffect(() => {
    measureConnectButton();
  }, [measureConnectButton, loading, accounts.length]);

  useEffect(() => {
    return () => {
      unregisterAnchor('accounts-connect');
    };
  }, [unregisterAnchor]);

  const syncNow = async () => {
    setSyncing(true);
    setError(null);
    try {
      await apiRequest('/api/plaid/accounts/sync', { method: 'POST' });
      await apiRequest('/api/plaid/transactions/sync', { method: 'POST' });
      await load();
    } finally {
      setSyncing(false);
    }
  };

  const removeAccount = async (accountId: string) => {
    setRemovingId(accountId);
    try {
      await apiRequest('/api/accounts', {
        method: 'DELETE',
        body: { accountId },
      });
      setAccounts((prev) => prev.filter((account) => account.id !== accountId));
    } finally {
      setRemovingId(null);
    }
  };

  const startLink = async () => {
    setLinking(true);
    setError(null);
    try {
      const data = await apiRequest<LinkTokenResponse>('/api/plaid/link-token', {
        method: 'POST',
        body: { mode: 'create', platform: Platform.OS },
      });
      await destroyPlaidLink();
      createPlaidLink({ token: data.link_token });
      openPlaidLink({
        onSuccess: async (success: LinkSuccess) => {
          await apiRequest('/api/plaid/exchange', {
            method: 'POST',
            body: { public_token: success.publicToken },
          });
          await apiRequest('/api/plaid/accounts/sync', { method: 'POST' });
          await apiRequest('/api/plaid/transactions/sync', { method: 'POST' });
          await load();
        },
        onExit: (exit: LinkExit) => {
          if (exit.error?.displayMessage || exit.error?.errorMessage) {
            setError(exit.error.displayMessage ?? exit.error.errorMessage);
          }
        },
      });
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to start Plaid Link on this build.'));
    } finally {
      setLinking(false);
    }
  };

  return (
    <Screen edgeToEdge>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Accounts</Text>
            <Text style={styles.headerSubtitle}>
              {clientName || 'Client'} · {accounts.length} connected accounts · {connectionCount}{' '}
              institutions
            </Text>
          </View>
          <View ref={connectButtonRef} onLayout={measureConnectButton}>
            <Pressable style={styles.primaryButton} onPress={startLink} disabled={linking}>
              <Text style={styles.primaryLabel}>{linking ? 'Opening...' : 'Add account'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.secondaryButton} onPress={syncNow} disabled={syncing}>
            <Text style={styles.secondaryLabel}>{syncing ? 'Syncing...' : 'Sync now'}</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading accounts...</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Connected accounts</Text>
          {accounts.length === 0 ? (
            <Text style={styles.emptyText}>
              No linked accounts yet. Tap Add account to connect your first bank.
            </Text>
          ) : (
            accounts.map((account) => (
              <View key={account.id} style={styles.accountRow}>
                <View>
                  <Text style={styles.accountName}>{account.name}</Text>
                  <Text style={styles.accountMeta}>
                    {account.institutionName ?? 'Bank'} · {account.type}
                    {account.mask ? ` · •••• ${account.mask}` : ''}
                  </Text>
                </View>
                <View style={styles.accountActions}>
                  <Text style={styles.accountBalance}>{formatCurrency(account.balance)}</Text>
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => removeAccount(account.id)}
                    disabled={removingId === account.id}
                  >
                    <Text style={styles.removeLabel}>
                      {removingId === account.id ? 'Removing...' : 'Remove'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
  actionRow: {
    flexDirection: 'row',
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
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  secondaryLabel: {
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    paddingVertical: 6,
    gap: 8,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    paddingHorizontal: 2,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  accountName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  accountMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  accountActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  accountBalance: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  removeButton: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  removeLabel: {
    color: colors.textMuted,
    fontSize: 11,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: 2,
  },
});
