import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../theme';

type ChipProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
};

export default function Chip({ label, active, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
    >
      <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipInactive: {
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  labelActive: {
    color: colors.primary,
  },
  labelInactive: {
    color: colors.text,
  },
});
