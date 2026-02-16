import type { Session } from '@supabase/supabase-js';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SvgXml } from 'react-native-svg';

import { supabase } from '../lib/supabase';
import { colors } from '../theme';
import { Screen } from './Screen';

type MfaMode = 'checking' | 'setup' | 'challenge' | 'ready';

type MfaGateProps = {
  session: Session;
  onSignOut: () => Promise<void>;
  children: ReactNode;
};

const normalizeMfaError = (message: string) => {
  if (message.includes('missing sub claim')) {
    return 'Your session is invalid for MFA. Sign out and log in again.';
  }
  return message;
};

const getSvgXml = (qrCode: string | null) => {
  if (!qrCode) return null;
  if (qrCode.startsWith('<svg')) return qrCode;
  if (!qrCode.startsWith('data:image/svg+xml')) return null;

  const encoded = qrCode.split(',')[1];
  if (!encoded) return null;

  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
};

export function MfaGate({ session, onSignOut, children }: MfaGateProps) {
  const [mode, setMode] = useState<MfaMode>('checking');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [sharedSecret, setSharedSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const refreshMfaStatus = useCallback(async () => {
    setError(null);
    setLoading(true);

    const [{ data: assuranceData, error: assuranceError }, { data: factorsData, error: factorsError }] =
      await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);

    if (assuranceError) {
      setError(normalizeMfaError(assuranceError.message));
      setLoading(false);
      return;
    }

    if (factorsError) {
      setError(normalizeMfaError(factorsError.message));
      setLoading(false);
      return;
    }

    const allFactors = [...(factorsData.totp ?? []), ...(factorsData.phone ?? [])];
    const verifiedFactor =
      allFactors.find((factor) => factor.status === 'verified') ?? null;
    const hasVerifiedFactor = Boolean(verifiedFactor);
    const isAal2 = assuranceData.currentLevel === 'aal2';

    if (!hasVerifiedFactor) {
      setMode('setup');
      setFactorId(null);
      setLoading(false);
      return;
    }

    if (!isAal2) {
      setMode('challenge');
      setFactorId(verifiedFactor?.id ?? null);
      setLoading(false);
      return;
    }

    setMode('ready');
    setFactorId(verifiedFactor?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    setMode('checking');
    setFactorId(null);
    setQrCode(null);
    setSharedSecret(null);
    setCode('');
    void refreshMfaStatus();
  }, [refreshMfaStatus, session.access_token]);

  const startEnrollment = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'LEDGR Mobile',
    });

    if (enrollError) {
      setError(normalizeMfaError(enrollError.message));
      setLoading(false);
      return;
    }

    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSharedSecret(data.totp.secret);
    setMode('setup');
    setLoading(false);
  }, []);

  const verifyCode = useCallback(async () => {
    if (!factorId || !code.trim()) return;

    setLoading(true);
    setError(null);

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });

    if (verifyError) {
      setError(normalizeMfaError(verifyError.message));
      setLoading(false);
      return;
    }

    setCode('');
    setQrCode(null);
    setSharedSecret(null);
    await refreshMfaStatus();
  }, [code, factorId, refreshMfaStatus]);

  const qrSvg = useMemo(() => getSvgXml(qrCode), [qrCode]);

  if (mode === 'ready') {
    return <>{children}</>;
  }

  const showSetup = mode === 'setup';
  const title = showSetup ? 'Set up MFA' : 'MFA required';
  const subtitle = showSetup
    ? 'Scan with your authenticator app, then enter the 6-digit code.'
    : 'Enter your authenticator code to finish sign in.';

  return (
    <Screen title={title} subtitle={subtitle}>
      <ScrollView contentContainerStyle={styles.container}>
        {mode === 'checking' ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.helper}>Checking account security…</Text>
          </View>
        ) : (
          <>
            {showSetup && !factorId ? (
              <Pressable style={styles.primaryButton} onPress={startEnrollment} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.primaryLabel}>Generate QR code</Text>
                )}
              </Pressable>
            ) : null}

            {showSetup && factorId ? (
              <View style={styles.qrCard}>
                {qrSvg ? (
                  <SvgXml xml={qrSvg} width={220} height={220} />
                ) : (
                  <Text style={styles.helper}>
                    QR preview unavailable. Add this secret manually:
                  </Text>
                )}
                {sharedSecret ? <Text style={styles.secret}>{sharedSecret}</Text> : null}
              </View>
            ) : null}

            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="6-digit code"
              placeholderTextColor={colors.textMuted}
            />

            <Pressable
              style={[styles.primaryButton, (!factorId || loading) && styles.buttonDisabled]}
              onPress={verifyCode}
              disabled={!factorId || loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.primaryLabel}>Verify and continue</Text>
              )}
            </Pressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable style={styles.linkButton} onPress={() => void onSignOut()}>
              <Text style={styles.linkText}>Sign out</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  qrCard: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  secret: {
    color: colors.text,
    fontSize: 12,
    letterSpacing: 0.7,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    backgroundColor: 'rgba(9, 13, 27, 0.7)',
  },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryLabel: {
    color: colors.background,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  linkText: {
    color: colors.textMuted,
    textDecorationLine: 'underline',
    fontSize: 13,
  },
});
