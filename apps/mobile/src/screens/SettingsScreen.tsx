import { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as LocalAuthentication from 'expo-local-authentication';

import { LegalDocumentModal } from '../components/LegalDocumentModal';
import { type LegalDocType } from '../content/legal';
import ModalSheet from '../components/ModalSheet';
import { Screen } from '../components/Screen';
import { useAppOnboarding } from '../context/AppOnboardingContext';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { DEMO_MODE_KEY, setDemoModeEnabled } from '../lib/demoMode';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';

type SettingsResponse = {
  monthlyIncomeOverride: number | null;
};

const FACE_ID_REQUIRED_KEY = 'settings.faceIdRequired';

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

const resolvedBaseUrl =
  Constants.expoConfig?.extra?.apiBaseUrl ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  process.env.EXPO_PUBLIC_API_URL ??
  'https://ledgr-henna.vercel.app';

const normalizedBaseUrl = resolvedBaseUrl.replace(/\/$/, '');

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeaderWrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function Row({
  label,
  value,
  onPress,
  danger,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={!onPress}>
      <Text style={[styles.rowLabel, danger && styles.rowDanger]}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    </Pressable>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onValueChange?: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, disabled && styles.rowDisabled]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: '#22c55e', false: 'rgba(148, 163, 184, 0.4)' }}
      />
    </View>
  );
}

function RadioRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={!onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={[styles.radioOuter, value && styles.radioOuterActive]}>
        {value ? <View style={styles.radioInner} /> : null}
      </View>
    </Pressable>
  );
}

export function SettingsScreen() {
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const { restart } = useAppOnboarding();
  const [overrideValue, setOverrideValue] = useState('');
  const [savedValue, setSavedValue] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('light');
  const [faceIdRequired, setFaceIdRequired] = useState(false);
  const [demoModeEnabled, setDemoModeState] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [faceIdBusy, setFaceIdBusy] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDocType | null>(null);
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const appVersion = useMemo(() => {
    const version = Constants.expoConfig?.version ?? '1.0.0';
    return version;
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const data = await apiRequest<SettingsResponse>('/api/settings');
        if (!isMounted) return;
        if (typeof data.monthlyIncomeOverride === 'number') {
          setSavedValue(data.monthlyIncomeOverride);
          setOverrideValue(String(data.monthlyIncomeOverride));
        } else {
          setSavedValue(null);
          setOverrideValue('');
        }

        const [storedTheme, storedFaceId, storedDemoMode] = await Promise.all([
          AsyncStorage.getItem('theme'),
          AsyncStorage.getItem(FACE_ID_REQUIRED_KEY),
          AsyncStorage.getItem(DEMO_MODE_KEY),
        ]);

        if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
          setTheme(storedTheme);
        } else {
          setTheme('light');
        }

        setFaceIdRequired(storedFaceId === 'true');
        setDemoModeState(storedDemoMode === 'true');
      } catch {
        // ignore load errors
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveOverride = async () => {
    setSaving(true);
    setStatus(null);
    const value = overrideValue.trim();
    const payload = value.length > 0 && !Number.isNaN(Number(value)) ? Number(value) : null;

    try {
      const data = await apiRequest<SettingsResponse>('/api/settings', {
        method: 'POST',
        body: { monthlyIncomeOverride: payload },
      });
      setSavedValue(data.monthlyIncomeOverride ?? null);
      setStatus('Income override saved.');
    } catch {
      setStatus('Unable to save override.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearOverride = async () => {
    setOverrideValue('');
    try {
      await apiRequest('/api/settings', {
        method: 'POST',
        body: { monthlyIncomeOverride: null },
      });
      setSavedValue(null);
      setStatus('Using detected income.');
    } catch {
      setStatus('Unable to update setting.');
    }
  };

  const handleThemeChange = async (nextTheme: 'system' | 'light' | 'dark') => {
    setTheme(nextTheme);
    await AsyncStorage.setItem('theme', nextTheme);
    Appearance.setColorScheme(nextTheme === 'system' ? null : nextTheme);
  };

  const openWebLink = async (path: string) => {
    try {
      await Linking.openURL(`${normalizedBaseUrl}${path}`);
    } catch {
      setStatus('Unable to open link.');
    }
  };

  const handleContactSupport = async () => {
    const subject = encodeURIComponent('LEDGR Support Request');
    const body = encodeURIComponent(
      `Hi LEDGR support,\n\nI need help with:\n\nApp version: ${appVersion}\nEmail: ${user?.email ?? 'unknown'}\n`
    );
    const url = `mailto:brandennevius@gmail.com?subject=${subject}&body=${body}`;
    try {
      await Linking.openURL(url);
    } catch {
      setStatus('Unable to open mail app.');
    }
  };

  const handleFaceIdToggle = async (nextValue: boolean) => {
    if (faceIdBusy) return;
    setFaceIdBusy(true);

    try {
      if (nextValue) {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();

        if (!compatible || !enrolled) {
          Alert.alert(
            'Face ID unavailable',
            'Biometric authentication is not available or not enrolled on this device.'
          );
          setFaceIdRequired(false);
          await AsyncStorage.setItem(FACE_ID_REQUIRED_KEY, 'false');
          return;
        }

        const authResult = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Enable Face ID lock for LEDGR',
          cancelLabel: 'Cancel',
          disableDeviceFallback: false,
        });

        if (!authResult.success) {
          setFaceIdRequired(false);
          await AsyncStorage.setItem(FACE_ID_REQUIRED_KEY, 'false');
          return;
        }
      }

      setFaceIdRequired(nextValue);
      await AsyncStorage.setItem(FACE_ID_REQUIRED_KEY, nextValue ? 'true' : 'false');
      setStatus(nextValue ? 'Face ID enabled.' : 'Face ID disabled.');
    } finally {
      setFaceIdBusy(false);
    }
  };

  const handleDemoModeToggle = async (nextValue: boolean) => {
    setDemoModeState(nextValue);
    await setDemoModeEnabled(nextValue);
    setStatus(nextValue ? 'Demo data enabled.' : 'Demo data disabled.');
  };

  const handleExportTransactions = async () => {
    setExporting(true);
    setStatus(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setStatus('You must be signed in to export transactions.');
        return;
      }

      const response = await fetch(`${normalizedBaseUrl}/api/transactions/export`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        setStatus('Unable to export transactions.');
        return;
      }

      const csv = await response.text();
      const filename = `ledgr-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      const tempPath = `${FileSystem.cacheDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(tempPath, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(tempPath, {
          mimeType: 'text/csv',
          dialogTitle: 'Export your transactions',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        setStatus(`Export saved to ${tempPath}`);
      }
    } catch {
      setStatus('Unable to export transactions.');
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  const handleDeleteAccount = async () => {
    if (deletingAccount) return;
    setDeletingAccount(true);
    setStatus(null);

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && enrolled) {
        const authResult = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Confirm account deletion',
          cancelLabel: 'Cancel',
          disableDeviceFallback: false,
        });

        if (!authResult.success) {
          setStatus('Account deletion cancelled.');
          return;
        }
      }

      await apiRequest('/api/account/delete', {
        method: 'POST',
        body: {
          email: deleteEmail.trim(),
          confirmation: deleteConfirmation.trim(),
        },
      });
      setDeleteSheetOpen(false);
      setDeleteEmail('');
      setDeleteConfirmation('');
      await signOut();
    } catch (err) {
      const message =
        typeof err === 'object' && err && 'error' in err
          ? String((err as { error?: string }).error)
          : 'Unable to delete account right now.';
      setStatus(message);
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleReplayTour = async () => {
    await restart();
    setStatus('App walkthrough restarted.');
  };

  return (
    <Screen edgeToEdge>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionHeader title="Account" />
        <View style={styles.sectionCard}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue}>{user?.email ?? 'Unknown'}</Text>
          </View>
          <Row
            label="Manage bank connections"
            onPress={() => navigation.navigate('ManageConnections' as never)}
          />
          <ToggleRow
            label={faceIdBusy ? 'Require Face ID (checking...)' : 'Require Face ID'}
            value={faceIdRequired}
            onValueChange={handleFaceIdToggle}
            disabled={faceIdBusy}
          />
          <Row
            label={exporting ? 'Exporting transactions...' : 'Export your transactions'}
            onPress={exporting ? undefined : handleExportTransactions}
          />
          <Row label="Delete account and data" onPress={() => setDeleteSheetOpen(true)} danger />
          <Row label="Log out" onPress={handleLogout} danger />
        </View>

        <SectionHeader title="About" />
        <View style={styles.sectionCard}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowValue}>{appVersion}</Text>
          </View>
          <Row label="Visit our Help Center" onPress={() => openWebLink('/help')} />
          <Row label="Contact Support" onPress={handleContactSupport} />
          <Row
            label="Visit our website"
            onPress={() => Linking.openURL('https://ledgr-henna.vercel.app')}
          />
          <Row label="Replay app walkthrough" onPress={handleReplayTour} />
          <Row label="Terms of service" onPress={() => setLegalDoc('terms')} />
          <Row label="Privacy policy" onPress={() => setLegalDoc('privacy')} />
        </View>

        <SectionHeader title="Advanced" />
        <View style={styles.sectionCard}>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>Loading settings...</Text>
            </View>
          ) : null}

          <Text style={styles.inputLabel}>Theme</Text>
          <View style={styles.themeRow}>
            {(['system', 'light', 'dark'] as const).map((option) => (
              <Pressable
                key={option}
                onPress={() => handleThemeChange(option)}
                style={[styles.themeChip, theme === option && styles.themeChipActive]}
              >
                <Text style={[styles.themeLabel, theme === option && styles.themeLabelActive]}>
                  {option === 'system' ? 'System' : option === 'light' ? 'Light' : 'Dark'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Portfolio mode</Text>
          <RadioRow
            label="Show demo data"
            value={demoModeEnabled}
            onPress={() => handleDemoModeToggle(!demoModeEnabled)}
          />

          {savedValue !== null ? (
            <Text style={styles.savedBadge}>Current override {formatCurrency(savedValue)}</Text>
          ) : null}

          <Text style={[styles.inputLabel, { marginTop: 12 }]}>Monthly income override</Text>
          <TextInput
            value={overrideValue}
            onChangeText={setOverrideValue}
            placeholder="e.g. 4500"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            style={styles.input}
          />

          <View style={styles.actionRow}>
            <Pressable style={styles.primaryButton} onPress={handleSaveOverride} disabled={saving}>
              <Text style={styles.primaryLabel}>{saving ? 'Saving...' : 'Save override'}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={handleClearOverride}>
              <Text style={styles.secondaryLabel}>Use detected income</Text>
            </Pressable>
          </View>
        </View>

        {status ? <Text style={styles.statusText}>{status}</Text> : null}
      </ScrollView>
      <LegalDocumentModal visible={legalDoc !== null} type={legalDoc} onClose={() => setLegalDoc(null)} />
      <ModalSheet visible={deleteSheetOpen} onClose={() => setDeleteSheetOpen(false)}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.deleteSheetContent}>
            <Text style={styles.deleteTitle}>Delete account and data</Text>
            <Text style={styles.deleteBody}>
              This permanently removes your LEDGR profile, linked accounts, transactions,
              categories, goals, reviews, and chat data from the app database.
            </Text>
            <Text style={styles.deleteBody}>
              To confirm, enter your email and type DELETE below.
            </Text>

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              value={deleteEmail}
              onChangeText={setDeleteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder={user?.email ?? 'name@example.com'}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <Text style={styles.inputLabel}>Type DELETE</Text>
            <TextInput
              value={deleteConfirmation}
              onChangeText={setDeleteConfirmation}
              autoCapitalize="characters"
              placeholder="DELETE"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <View style={styles.actionRow}>
              <Pressable
                style={styles.deleteButton}
                onPress={handleDeleteAccount}
                disabled={deletingAccount}
              >
                <Text style={styles.deleteButtonLabel}>
                  {deletingAccount ? 'Deleting...' : 'Delete permanently'}
                </Text>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setDeleteSheetOpen(false)}
                disabled={deletingAccount}
              >
                <Text style={styles.secondaryLabel}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </ModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 74,
    paddingHorizontal: 20,
    paddingBottom: 34,
    gap: 10,
  },
  sectionHeaderWrap: {
    marginTop: 6,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  sectionCard: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
    paddingHorizontal: 2,
    gap: 12,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '500',
    flex: 1,
  },
  rowValue: {
    color: colors.textMuted,
    fontSize: 16,
  },
  rowDanger: {
    color: colors.danger,
  },
  rowDisabled: {
    opacity: 0.6,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  inputLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 10,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeChip: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 8,
    alignItems: 'center',
  },
  themeChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  themeLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  themeLabelActive: {
    color: colors.text,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  savedBadge: {
    marginTop: 12,
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: colors.inputBg,
  },
  actionRow: {
    gap: 10,
    marginTop: 12,
    marginBottom: 8,
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  secondaryLabel: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 12,
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 8,
  },
  deleteSheetContent: {
    gap: 6,
    paddingBottom: 12,
  },
  deleteTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  deleteBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  deleteButton: {
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.danger,
  },
  deleteButtonLabel: {
    color: colors.background,
    fontWeight: '700',
  },
});
