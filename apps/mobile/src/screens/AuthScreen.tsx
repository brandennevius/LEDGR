import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Screen } from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

export function AuthScreen() {
  const { signInWithPassword, signUp, signInWithOAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (mode: 'signIn' | 'signUp') => {
    setLoading(true);
    setError(null);
    const action = mode === 'signIn' ? signInWithPassword : signUp;
    const result = await action(email.trim(), password);
    if (result) {
      setError(result);
    }
    setLoading(false);
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setLoading(true);
    setError(null);
    const result = await signInWithOAuth(provider);
    if (result) {
      setError(result);
    }
    setLoading(false);
  };

  return (
    <Screen title="Welcome back" subtitle="Sign in to your financial coach">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
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
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={styles.input}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.button, styles.primaryButton]}
            onPress={() => handleAuth('signIn')}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.primaryLabel}>Sign In</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.button, styles.secondaryButton]}
            onPress={() => handleAuth('signUp')}
            disabled={loading}
          >
            <Text style={styles.secondaryLabel}>Create Account</Text>
          </Pressable>
        </View>
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
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 16,
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
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    backgroundColor: 'rgba(9, 13, 27, 0.7)',
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
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  primaryLabel: {
    color: colors.background,
    fontWeight: '700',
  },
  secondaryLabel: {
    color: colors.text,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  oauthLabel: {
    color: colors.text,
    fontWeight: '600',
  },
});
