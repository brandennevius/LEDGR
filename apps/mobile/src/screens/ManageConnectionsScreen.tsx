import { useCallback, useMemo, useState } from 'react';
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
import { apiRequest } from '../lib/api';
import { getDemoModeEnabled } from '../lib/demoMode';
import { formatRelativeSyncTime, isStaleSync } from '../lib/syncStatus';
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
  connectionStatus?: {
    state: 'connected' | 'attention' | 'disconnected';
    title: string;
    description: string;
  };
  syncSummary?: {
    totalConnections: number;
    activeConnections: number;
    staleConnections: number;
    attentionConnections: number;
    lastSuccessfulSyncAt?: string | null;
  };
};

type LinkTokenResponse = { link_token: string };
type UpdateAction = 'repair' | 'add_accounts';

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

const statusLabel = (status: string) => status.replaceAll('_', ' ');

export function ManageConnectionsScreen() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [clientName, setClientName] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<
    OverviewResponse['connectionStatus'] | null
  >(null);
  const [syncSummary, setSyncSummary] = useState<OverviewResponse['syncSummary'] | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoModeEnabled, setDemoModeEnabled] = useState(false);

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
      setConnections(data.plaidItems ?? []);
      setAccounts(data.accounts ?? []);
      setClientName(data.clientName ?? '');
      setConnectionStatus(data.connectionStatus ?? null);
      setSyncSummary(data.syncSummary ?? null);
      setError(null);
    } catch (err) {
      const message =
        typeof err === 'object' && err && 'error' in err
          ? String((err as { error?: string }).error)
          : 'Unable to load connections.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void getDemoModeEnabled().then(setDemoModeEnabled);
      void load();
    }, [load])
  );

  const syncNow = async () => {
    if (demoModeEnabled) return;
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

  const startNewConnection = async () => {
    if (demoModeEnabled) return;
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
      setError(getErrorMessage(err, 'Unable to start Plaid Link right now.'));
    } finally {
      setLinking(false);
    }
  };

  const updateConnection = async (itemId: string, action: UpdateAction) => {
    if (demoModeEnabled) return;
    setUpdatingItemId(itemId);
    setError(null);
    try {
      const data = await apiRequest<LinkTokenResponse>('/api/plaid/link-token', {
        method: 'POST',
        body: { mode: 'update', itemId, platform: Platform.OS, action },
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
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to update this connection right now.'));
    } finally {
      setUpdatingItemId(null);
    }
  };

  const accountsByInternalItem = useMemo(() => {
    const map = new Map<string, Account[]>();
    accounts.forEach((account) => {
      if (!account.plaidItemId) return;
      const list = map.get(account.plaidItemId) ?? [];
      list.push(account);
      map.set(account.plaidItemId, list);
    });
    return map;
  }, [accounts]);

  const attentionConnections = useMemo(
    () =>
      connections.filter(
        (connection) => connection.status !== 'active' || isStaleSync(connection.updatedAt)
      ),
    [connections]
  );
  const activeConnections = useMemo(
    () =>
      connections.filter(
        (connection) => connection.status === 'active' && !isStaleSync(connection.updatedAt)
      ),
    [connections]
  );

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderConnection = (connection: Connection) => {
    const linkedAccounts = accountsByInternalItem.get(connection.id) ?? [];
    const isExpanded = expanded[connection.id] === true;
    const isBusy = updatingItemId === connection.itemId || linking;
    const isAttention = connection.status !== 'active';
    const isDisabled = isBusy || demoModeEnabled;
    const isStale = !isAttention && isStaleSync(connection.updatedAt);
    return (
      <View key={connection.id} style={styles.connectionCard}>
        <Pressable style={styles.connectionHeader} onPress={() => toggleExpanded(connection.id)}>
          <View style={styles.connectionMetaWrap}>
            <Text style={styles.connectionName}>{connection.institutionName ?? 'Bank connection'}</Text>
            <Text style={styles.connectionMeta}>
              {isStale ? 'stale sync' : statusLabel(connection.status)} · {linkedAccounts.length}{' '}
              accounts
            </Text>
            <Text style={styles.connectionSyncMeta}>{formatRelativeSyncTime(connection.updatedAt)}</Text>
          </View>
          <View style={styles.connectionHeaderRight}>
            <View style={[styles.statusPill, isAttention ? styles.statusPillDanger : isStale ? styles.statusPillWarning : styles.statusPillHealthy]}>
              <Text style={styles.statusPillLabel}>
                {isAttention ? 'Needs attention' : isStale ? 'Stale' : 'Healthy'}
              </Text>
            </View>
            <Text style={styles.chevron}>{isExpanded ? '▾' : '▸'}</Text>
          </View>
        </Pressable>

        <View style={styles.connectionButtons}>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => updateConnection(connection.itemId, 'repair')}
            disabled={isDisabled}
          >
            <Text style={styles.secondaryLabel}>
              {demoModeEnabled
                ? 'Demo mode'
                : isBusy
                ? 'Opening...'
                : isAttention
                ? 'Reconnect'
                : 'Update login'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => updateConnection(connection.itemId, 'add_accounts')}
            disabled={isDisabled}
          >
            <Text style={styles.secondaryLabel}>
              {demoModeEnabled ? 'Demo mode' : 'Add accounts'}
            </Text>
          </Pressable>
        </View>

        {isExpanded ? (
          <View style={styles.accountsList}>
            {linkedAccounts.length === 0 ? (
              <Text style={styles.emptyText}>No accounts mapped to this connection yet.</Text>
            ) : (
              linkedAccounts.map((account) => (
                <View key={account.id} style={styles.accountRow}>
                  <View>
                    <Text style={styles.accountName}>{account.name}</Text>
                    <Text style={styles.accountMeta}>
                      {account.type}
                      {account.mask ? ` · •••• ${account.mask}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.accountBalance}>{formatCurrency(account.balance)}</Text>
                </View>
              ))
            )}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Screen edgeToEdge>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Manage connections</Text>
            <Text style={styles.headerSubtitle}>
              {clientName || 'Client'} · {connections.length} institutions
            </Text>
            {syncSummary?.lastSuccessfulSyncAt ? (
              <Text style={styles.headerSyncText}>
                {formatRelativeSyncTime(syncSummary.lastSuccessfulSyncAt)}
              </Text>
            ) : null}
          </View>
          <Pressable
            style={styles.primaryButton}
            onPress={startNewConnection}
            disabled={linking || demoModeEnabled}
          >
            <Text style={styles.primaryLabel}>
              {demoModeEnabled ? 'Demo mode' : linking ? 'Opening...' : 'Add connection'}
            </Text>
          </Pressable>
        </View>

        {demoModeEnabled ? (
          <Text style={styles.demoNote}>
            Demo mode is on. Connection management actions are disabled while sample data is active.
          </Text>
        ) : null}

        {connectionStatus && connectionStatus.state !== 'connected' ? (
          <View
            style={[
              styles.syncBanner,
              connectionStatus.state === 'disconnected'
                ? styles.syncBannerDanger
                : styles.syncBannerWarning,
            ]}
          >
            <Text style={styles.syncBannerTitle}>{connectionStatus.title}</Text>
            <Text style={styles.syncBannerBody}>{connectionStatus.description}</Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable
            style={styles.secondaryButton}
            onPress={syncNow}
            disabled={syncing || demoModeEnabled}
          >
            <Text style={styles.secondaryLabel}>
              {demoModeEnabled ? 'Demo data loaded' : syncing ? 'Syncing...' : 'Sync all now'}
            </Text>
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
          <Text style={styles.sectionTitle}>Needs attention</Text>
          {attentionConnections.length === 0 ? (
            <Text style={styles.emptyText}>No connections need action right now.</Text>
          ) : (
            attentionConnections.map(renderConnection)
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Connected institutions</Text>
          {activeConnections.length === 0 ? (
            <Text style={styles.emptyText}>No active connections yet.</Text>
          ) : (
            activeConnections.map(renderConnection)
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
    gap: 10,
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
  headerSyncText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  syncBanner: {
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  syncBannerWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  syncBannerDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  syncBannerTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  syncBannerBody: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  primaryButton: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.primary,
  },
  primaryLabel: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
  },
  demoNote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
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
  connectionCard: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 10,
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  connectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  connectionMetaWrap: {
    flex: 1,
    gap: 3,
  },
  connectionName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  connectionMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  connectionSyncMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  connectionHeaderRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillHealthy: {
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
  },
  statusPillWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  statusPillDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  statusPillLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },
  connectionButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  accountsList: {
    gap: 8,
    paddingTop: 2,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
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
    marginTop: 2,
  },
  accountBalance: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: 2,
  },
});
