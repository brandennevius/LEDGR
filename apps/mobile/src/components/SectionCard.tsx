import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

type SectionCardProps = {
  title: string;
  children: ReactNode;
  subtitle?: string;
};

export default function SectionCard({ title, subtitle, children }: SectionCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    color: theme.colors.muted,
    fontSize: 12,
  },
  body: {
    gap: 10,
  },
});
