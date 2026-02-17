import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { apiRequest } from '../lib/api';
import { colors } from '../theme';

type Account = {
  id: string;
  plaidItemId?: string;
  name: string;
  type: string;
  mask?: string;
  institutionName?: string;
  balance: number;
};

type Connection = {
  id: string;
  itemId: string;
  institutionName?: string;
  status: string;
  updatedAt: string;
};

type OverviewResponse = {
  clientName: string;
  accounts: Account[];
  plaidItems: Connection[];
};

type LinkTokenResponse = { link_token: string };

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

export function AccountsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [repairingItemId, setRepairingItemId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removingAll, setRemovingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await apiRequest<OverviewResponse>('/api/client/overview');
      setAccounts(data.accounts ?? []);
      setConnections(data.plaidItems ?? []);
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
  };

  useEffect(() => {
    load();
  }, []);

  const connectionCounts = useMemo(() => {
    const itemIdByInternal = new Map(connections.map((connection) => [connection.id, connection.itemId]));
    const map = new Map<string, number>();
    connections.forEach((connection) => {
      map.set(connection.itemId, 0);
    });
    accounts.forEach((account) => {
      if (!account.plaidItemId) return;
      const itemId = itemIdByInternal.get(account.plaidItemId);
      if (!itemId) return;
      const count = map.get(itemId) ?? 0;
      map.set(itemId, count + 1);
    });
    return map;
  }, [accounts, connections]);

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

  const removeAll = async () => {
    setRemovingAll(true);
    try {
      await apiRequest('/api/accounts', {
        method: 'DELETE',
        body: { all: true },
      });
      setAccounts([]);
      setConnections([]);
    } finally {
      setRemovingAll(false);
    }
  };

  const startLink = async () => {
    setLinking(true);
    setError(null);
    try {
      const data = await apiRequest<LinkTokenResponse>('/api/plaid/link-token', {
        method: 'POST',
        body: { mode: 'create' },
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
    } catch {
      setError('Unable to start Plaid Link on this build.');
    } finally {
      setLinking(false);
    }
  };

  const repairConnection = async (itemId: string) => {
    setRepairingItemId(itemId);
    setError(null);
    try {
      const data = await apiRequest<LinkTokenResponse>('/api/plaid/link-token', {
        method: 'POST',
        body: { mode: 'update', itemId },
      });
      await destroyPlaidLink();
      createPlaidLink({ token: data.link_token });
      openPlaidLink({
        onSuccess: async () => {
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
    } catch {
      setError('Unable to update this connection right now.');
    } finally {
      setRepairingItemId(null);
    }
  };

  return (
    <Screen title="Accounts" subtitle="Manage connected banks and sync status." edgeToEdge>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Linked accounts</Text>
            <Text style={styles.headerSubtitle}>
              {clientName || 'Client'} · {accounts.length} accounts · {connections.length} connections
            </Text>
          </View>
          <Pressable style={styles.primaryButton} onPress={startLink}>
            <Text style={styles.primaryLabel}>{linking ? 'Opening...' : 'Connect'}</Text>
          </Pressable>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.secondaryButton} onPress={syncNow} disabled={syncing}>
            <Text style={styles.secondaryLabel}>{syncing ? 'Syncing...' : 'Sync now'}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={removeAll} disabled={removingAll}>
            <Text style={styles.secondaryLabel}>{removingAll ? 'Removing...' : 'Remove all'}</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading connections...</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Connections</Text>
          {connections.length === 0 ? (
            <Text style={styles.emptyText}>No connections yet. Link a bank to get started.</Text>
          ) : (
            connections.map((connection) => (
              <View key={connection.id} style={styles.connectionRow}>
                <View style={styles.connectionInfo}>
                  <Text style={styles.connectionName}>
                    {connection.institutionName ?? 'Bank connection'}
                  </Text>
                  <Text style={styles.connectionMeta}>
                    Status: {connection.status} · {connectionCounts.get(connection.itemId) ?? 0} accounts
                  </Text>
                </View>
                <View style={styles.connectionActions}>
                  <Text style={styles.connectionMeta}>
                    Updated {new Date(connection.updatedAt).toLocaleDateString()}
                  </Text>
                  <Pressable
                    style={styles.repairButton}
                    onPress={() => repairConnection(connection.itemId)}
                    disabled={repairingItemId === connection.itemId || linking}
                  >
                    <Text style={styles.repairLabel}>
                      {repairingItemId === connection.itemId ? 'Updating...' : 'Update login'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Accounts</Text>
          {accounts.length === 0 ? (
            <Text style={styles.emptyText}>No linked accounts yet.</Text>
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
    gap: 10,
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
    flex: 1,
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
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  connectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  connectionActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  connectionMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  repairButton: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  repairLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
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
});
