import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { LegalDocumentModal } from '../components/LegalDocumentModal';
import { type LegalDocType } from '../content/legal';
import { Screen } from '../components/Screen';
import { apiRequest } from '../lib/api';
import { colors } from '../theme';

export function PolicyConsentScreen({
  onAccepted,
}: {
  onAccepted: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legalDoc, setLegalDoc] = useState<LegalDocType | null>(null);

  const acceptPolicies = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/api/policies/accept', {
        method: 'POST',
        body: { acceptTerms: true, acceptPrivacy: true },
      });
      onAccepted();
    } catch {
      setError('Unable to save policy acceptance. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="One More Step" subtitle="Review and accept to continue." topInset>
      <View style={styles.container}>
        <Text style={styles.body}>
          To use LEDGR, please review and accept the current Terms of Service and Privacy Policy.
        </Text>
        <View style={styles.linkRow}>
          <Text style={styles.link} onPress={() => setLegalDoc('terms')}>
            Terms of Service
          </Text>
          <Text style={styles.link} onPress={() => setLegalDoc('privacy')}>
            Privacy Policy
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.acceptButton} onPress={acceptPolicies} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.acceptLabel}>Accept and Continue</Text>
          )}
        </Pressable>
      </View>
      <LegalDocumentModal visible={legalDoc !== null} type={legalDoc} onClose={() => setLegalDoc(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 16,
  },
  body: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  linkRow: {
    gap: 8,
  },
  link: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  acceptButton: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  acceptLabel: {
    color: colors.background,
    fontWeight: '700',
  },
});
