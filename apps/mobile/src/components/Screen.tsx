import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, gradients } from '../theme';

type ScreenProps = {
  title?: string;
  subtitle?: string;
  edgeToEdge?: boolean;
  topInset?: boolean;
  children?: ReactNode;
};

export function Screen({
  title,
  subtitle,
  edgeToEdge = false,
  topInset = false,
  children,
}: ScreenProps) {
  return (
    <LinearGradient colors={gradients.app} style={styles.root}>
      <SafeAreaView
        style={[
          styles.safe,
          topInset && styles.safeWithTopInset,
          edgeToEdge && styles.safeEdgeToEdge,
        ]}
        edges={topInset ? ['top', 'left', 'right'] : ['left', 'right']}
      >
        {(title || subtitle) && (
          <View style={[styles.header, edgeToEdge && styles.edgeHeader]}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        )}
        {edgeToEdge ? (
          <View style={styles.edgeContent}>{children}</View>
        ) : (
          <View style={styles.contentFlat}>
            <View style={styles.inner}>{children}</View>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  safeWithTopInset: {
    paddingTop: 12,
  },
  safeEdgeToEdge: {
    paddingHorizontal: 0,
  },
  header: {
    marginBottom: 16,
  },
  edgeHeader: {
    paddingHorizontal: 20,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: 6,
    fontSize: 14,
  },
  contentFlat: {
    flex: 1,
  },
  inner: {
    flex: 1,
    padding: 20,
    backgroundColor: 'transparent',
  },
  edgeContent: {
    flex: 1,
  },
});
