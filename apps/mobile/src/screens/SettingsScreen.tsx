import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import Constants from 'expo-constants';

import { Screen } from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { colors } from '../theme';

type SettingsResponse = {
  monthlyIncomeOverride: number | null;
};

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

const privacyPolicyUrl = `${resolvedBaseUrl.replace(/\/$/, '')}/privacy`;

export function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [overrideValue, setOverrideValue] = useState('');
  const [savedValue, setSavedValue] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');

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
        const stored = await AsyncStorage.getItem('theme');
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setTheme(stored);
        }
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

  const handleSave = async () => {
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
      setStatus('Saved.');
    } catch {
      setStatus('Unable to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setOverrideValue('');
    try {
      await apiRequest('/api/settings', {
        method: 'POST',
        body: { monthlyIncomeOverride: null },
      });
      setSavedValue(null);
      setStatus('Reverted to detected income.');
    } catch {
      setStatus('Unable to update settings.');
    }
  };

  const handleThemeChange = async (value: 'system' | 'light' | 'dark') => {
    setTheme(value);
    await AsyncStorage.setItem('theme', value);
    Appearance.setColorScheme(value === 'system' ? null : value);
    setStatus(`Theme set to ${value}.`);
  };

  const handleOpenPrivacy = async () => {
    try {
      await Linking.openURL(privacyPolicyUrl);
    } catch {
      setStatus('Unable to open privacy policy.');
    }
  };

  return (
    <Screen edgeToEdge>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>Signed in as</Text>
          <Text style={styles.value}>{user?.email ?? 'Unknown'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <Text style={styles.sectionSubtitle}>Choose a theme for the dashboard.</Text>
          <View style={styles.themeRow}>
            {(['system', 'light', 'dark'] as const).map((option) => (
              <Pressable
                key={option}
                onPress={() => handleThemeChange(option)}
                style={[styles.themeChip, theme === option && styles.themeChipActive]}
              >
                <Text
                  style={[styles.themeLabel, theme === option && styles.themeLabelActive]}
                >
                  {option === 'system' ? 'System' : option === 'light' ? 'Light' : 'Dark'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <Text style={styles.sectionSubtitle}>
            Review how LEDGR handles personal and financial data.
          </Text>
          <Pressable style={styles.secondaryButton} onPress={handleOpenPrivacy}>
            <Text style={styles.secondaryLabel}>Open Privacy Policy</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Income override</Text>
          <Text style={styles.sectionSubtitle}>
            Override the monthly income forecast when deposits are irregular.
          </Text>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>Loading settings...</Text>
            </View>
          ) : null}
          {savedValue !== null ? (
            <Text style={styles.savedBadge}>Current override {formatCurrency(savedValue)}</Text>
          ) : null}
          <TextInput
            value={overrideValue}
            onChangeText={setOverrideValue}
            placeholder="e.g. 4500"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            style={styles.input}
          />
          <View style={styles.actionRow}>
            <Pressable style={styles.primaryButton} onPress={handleSave} disabled={saving}>
              <Text style={styles.primaryLabel}>{saving ? 'Saving...' : 'Save override'}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={handleClear}>
              <Text style={styles.secondaryLabel}>Use detected income</Text>
            </Pressable>
          </View>
          {status ? <Text style={styles.statusText}>{status}</Text> : null}
        </View>

        <Pressable style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutLabel}>Sign Out</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingTop: 76,
    paddingHorizontal: 20,
    gap: 16,
  },
  card: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    color: colors.text,
    marginTop: 8,
    fontSize: 15,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  savedBadge: {
    marginTop: 10,
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
    marginTop: 12,
    backgroundColor: colors.inputBg,
  },
  actionRow: {
    gap: 10,
    marginTop: 12,
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
    marginTop: 10,
  },
  signOutButton: {
    backgroundColor: colors.danger,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  signOutLabel: {
    color: colors.background,
    fontWeight: '700',
  },
});
