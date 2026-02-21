import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { useAppOnboarding } from '../context/AppOnboardingContext';
import { colors } from '../theme';

export function AppOnboardingOverlay({ disabled }: { disabled?: boolean }) {
  const { width, height } = useWindowDimensions();
  const { loading, active, currentStep, stepIndex, totalSteps, anchors, next, skip } =
    useAppOnboarding();

  if (loading || !active || !currentStep || disabled) {
    return null;
  }

  const anchor = currentStep.anchorId ? anchors[currentStep.anchorId] : null;

  const cardTop = (() => {
    if (!anchor) return null;
    const preferred = anchor.y + anchor.height + 14;
    const maxTop = height - 240;
    if (preferred <= maxTop) return Math.max(84, preferred);
    return Math.max(84, anchor.y - 210);
  })();

  const cardStyle = cardTop === null ? { left: 18, right: 18, bottom: 106 } : { left: 18, right: 18, top: cardTop };

  const arrowStyle =
    cardTop === null
      ? { left: width * 0.5 - 10, bottom: 84, transform: [{ rotate: '180deg' as const }] }
      : {
          left: anchor ? Math.max(18, Math.min(width - 36, anchor.x + anchor.width / 2 - 10)) : width * 0.5 - 10,
          top: cardTop - 20,
        };

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <View style={styles.scrim} />
      {anchor ? (
        <View
          pointerEvents="none"
          style={[
            styles.anchorRing,
            {
              left: Math.max(0, anchor.x - 6),
              top: Math.max(0, anchor.y - 6),
              width: anchor.width + 12,
              height: anchor.height + 12,
            },
          ]}
        />
      ) : null}

      <Text style={[styles.arrow, arrowStyle]}>▲</Text>

      <View style={[styles.card, cardStyle]}>
        <Text style={styles.progress}>
          Step {stepIndex + 1} of {totalSteps}
        </Text>
        <Text style={styles.title}>{currentStep.title}</Text>
        <Text style={styles.body}>{currentStep.body}</Text>

        <View style={styles.actions}>
          <Pressable style={styles.ghostButton} onPress={() => void skip()}>
            <Text style={styles.ghostLabel}>Skip tour</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={() => void next()}>
            <Text style={styles.primaryLabel}>{currentStep.nextLabel ?? 'Next'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
  },
  anchorRing: {
    position: 'absolute',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  arrow: {
    position: 'absolute',
    color: colors.primary,
    fontSize: 20,
    fontWeight: '900',
  },
  card: {
    position: 'absolute',
    backgroundColor: '#04162a',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  progress: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  ghostButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  ghostLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  primaryLabel: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '800',
  },
});
