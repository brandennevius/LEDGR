import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { LegalDocumentModal } from '../components/LegalDocumentModal';
import { type LegalDocType } from '../content/legal';
import { Screen } from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

type Mode = 'signIn' | 'signUp';

const parseVerifiedFromUrl = (value?: string | null) => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.searchParams.get('verified') === '1';
  } catch {
    return value.includes('verified=1');
  }
};

function LegalCheck({
  checked,
  onToggle,
  labelPrefix,
  labelAction,
  onOpen,
}: {
  checked: boolean;
  onToggle: () => void;
  labelPrefix: string;
  labelAction: string;
  onOpen: () => void;
}) {
  return (
    <View style={styles.checkRow}>
      <Pressable onPress={onToggle} style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <View style={styles.checkboxDot} /> : null}
      </Pressable>
      <Text style={styles.checkText}>
        {labelPrefix}{' '}
        <Text style={styles.checkLink} onPress={onOpen}>
          {labelAction}
        </Text>
      </Text>
    </View>
  );
}

export function AuthScreen() {
  const { signInWithPassword, signUp, signInWithOAuth } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [legalDoc, setLegalDoc] = useState<LegalDocType | null>(null);

  useEffect(() => {
    let mounted = true;
    Linking.getInitialURL()
      .then((url) => {
        if (!mounted) return;
        if (parseVerifiedFromUrl(url)) {
          setMode('signIn');
          setNotice('Email verified. Please sign in.');
        }
      })
      .catch(() => null);

    const sub = Linking.addEventListener('url', ({ url }) => {
      if (parseVerifiedFromUrl(url)) {
        setMode('signIn');
        setNotice('Email verified. Please sign in.');
      }
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const canSubmit = useMemo(() => {
    if (!email.trim() || !password) return false;
    if (mode === 'signUp') {
      return (
        password === confirmPassword &&
        password.length >= 8 &&
        acceptTerms &&
        acceptPrivacy
      );
    }
    return true;
  }, [acceptPrivacy, acceptTerms, confirmPassword, email, mode, password]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setNotice(null);

    if (mode === 'signIn') {
      const result = await signInWithPassword(email.trim(), password);
      if (result) setError(result);
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setLoading(false);
      setError('Passwords do not match.');
      return;
    }

    const result = await signUp(email.trim(), password, {
      termsAccepted: acceptTerms,
      privacyAccepted: acceptPrivacy,
    });
    if (result) {
      setError(result);
    } else {
      setMode('signIn');
      setNotice('Check your email to verify your account, then sign in.');
      setPassword('');
      setConfirmPassword('');
    }
    setLoading(false);
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setLoading(true);
    setError(null);
    setNotice(null);
    const result = await signInWithOAuth(provider);
    if (result) {
      setError(result);
    }
    setLoading(false);
  };

  return (
    <Screen title="LEDGR" subtitle="Private money clarity, every day." topInset>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.modeRow}>
            <Pressable
              style={[styles.modeButton, mode === 'signIn' && styles.modeButtonActive]}
              onPress={() => {
                setMode('signIn');
                setError(null);
              }}
            >
              <Text style={[styles.modeLabel, mode === 'signIn' && styles.modeLabelActive]}>Log in</Text>
            </Pressable>
            <Pressable
              style={[styles.modeButton, mode === 'signUp' && styles.modeButtonActive]}
              onPress={() => {
                setMode('signUp');
                setError(null);
              }}
            >
              <Text style={[styles.modeLabel, mode === 'signUp' && styles.modeLabelActive]}>Create account</Text>
            </Pressable>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={styles.input}
            />
          </View>

          {mode === 'signUp' ? (
            <>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Confirm password</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  style={styles.input}
                />
              </View>
              <View style={styles.legalBox}>
                <LegalCheck
                  checked={acceptTerms}
                  onToggle={() => setAcceptTerms((prev) => !prev)}
                  labelPrefix="I agree to the"
                  labelAction="Terms of Service"
                  onOpen={() => setLegalDoc('terms')}
                />
                <LegalCheck
                  checked={acceptPrivacy}
                  onToggle={() => setAcceptPrivacy((prev) => !prev)}
                  labelPrefix="I acknowledge the"
                  labelAction="Privacy Policy"
                  onOpen={() => setLegalDoc('privacy')}
                />
              </View>
            </>
          ) : null}

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.button, styles.primaryButton, !canSubmit && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading || !canSubmit}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.primaryLabel}>{mode === 'signIn' ? 'Sign In' : 'Create Account'}</Text>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, styles.oauthButton]}
              onPress={() => handleOAuth('google')}
              disabled={loading}
            >
              <Text style={styles.oauthLabel}>Google</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.oauthButton]}
              onPress={() => handleOAuth('apple')}
              disabled={loading}
            >
              <Text style={styles.oauthLabel}>Apple</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <LegalDocumentModal visible={legalDoc !== null} type={legalDoc} onClose={() => setLegalDoc(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    gap: 12,
    paddingBottom: 24,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surfaceMuted,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  modeButtonActive: {
    backgroundColor: colors.primarySoft,
  },
  modeLabel: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  modeLabelActive: {
    color: colors.text,
    fontWeight: '700',
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    backgroundColor: colors.inputBg,
  },
  legalBox: {
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    padding: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  checkboxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  checkboxDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  checkText: {
    color: colors.textMuted,
    fontSize: 13,
    flex: 1,
  },
  checkLink: {
    color: colors.primary,
    fontWeight: '700',
  },
  notice: {
    color: colors.success,
    fontSize: 13,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  primaryLabel: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 15,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.cardBorder,
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  oauthButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  oauthLabel: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
});
