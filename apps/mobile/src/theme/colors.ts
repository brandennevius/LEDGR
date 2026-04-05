import { DynamicColorIOS, Platform } from 'react-native';

const dynamic = (light: string, dark: string) =>
  Platform.OS === 'ios' ? DynamicColorIOS({ light, dark }) : dark;

export const colors = {
  background: dynamic('#F5F7FB', '#0B0F1E'),
  backgroundAlt: dynamic('#EAF0F8', '#11162B'),
  surface: dynamic('#FFFFFF', '#151B34'),
  surfaceMuted: dynamic('#F8FAFD', '#10162B'),
  surfaceTint: dynamic('#EEF4FF', 'rgba(56, 189, 248, 0.08)'),
  card: dynamic('rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.08)'),
  cardBorder: dynamic('#D7E2EE', 'rgba(255, 255, 255, 0.06)'),
  cardBorderStrong: dynamic('#C3CFDD', 'rgba(255, 255, 255, 0.14)'),
  chrome: dynamic('#213A7B', '#0C1530'),
  chromeAlt: dynamic('#4C6FE7', '#1D4ED8'),
  chromeText: dynamic('#F8FBFF', '#E6E9F2'),
  chromeTextMuted: dynamic('rgba(248, 251, 255, 0.72)', '#A7B0C2'),
  chromeButtonBg: dynamic('rgba(255, 255, 255, 0.22)', 'rgba(255, 255, 255, 0.08)'),
  chromeButtonBorder: dynamic('rgba(255, 255, 255, 0.34)', 'rgba(255, 255, 255, 0.14)'),
  elevated: dynamic('#FFFFFF', 'rgba(255, 255, 255, 0.06)'),
  inputBg: dynamic('#F8FBFF', 'rgba(9, 13, 27, 0.7)'),
  inputBorder: dynamic('#C8D5E5', 'rgba(255, 255, 255, 0.12)'),
  backdrop: dynamic('rgba(15, 23, 42, 0.24)', 'rgba(9, 12, 18, 0.65)'),
  userBubble: dynamic('#EAF2FF', 'rgba(114, 92, 255, 0.25)'),
  assistantBubble: dynamic('#F5F8FC', 'rgba(255, 255, 255, 0.06)'),
  progressTrack: dynamic('#E6ECF4', 'rgba(255, 255, 255, 0.08)'),
  shadow: dynamic('rgba(15, 23, 42, 0.08)', 'rgba(0, 0, 0, 0.3)'),
  text: dynamic('#10233F', '#E6E9F2'),
  textMuted: dynamic('#607089', '#A7B0C2'),
  primary: dynamic('#2F6BFF', '#60A5FA'),
  primarySoft: dynamic('rgba(47, 107, 255, 0.12)', 'rgba(96, 165, 250, 0.16)'),
  accent: dynamic('#0F9D8F', '#2DD4BF'),
  accentSoft: dynamic('rgba(15, 157, 143, 0.12)', 'rgba(45, 212, 191, 0.16)'),
  success: dynamic('#16A34A', '#22C55E'),
  successSoft: dynamic('rgba(22, 163, 74, 0.12)', 'rgba(34, 197, 94, 0.16)'),
  warning: dynamic('#D97706', '#F59E0B'),
  warningSoft: dynamic('rgba(217, 119, 6, 0.12)', 'rgba(245, 158, 11, 0.16)'),
  danger: dynamic('#DC2626', '#F87171'),
  dangerSoft: dynamic('rgba(220, 38, 38, 0.12)', 'rgba(248, 113, 113, 0.16)'),
};

export const gradients = {
  appDark: ['#0B0F1E', '#101734', '#0B0F1E'] as const,
  appLight: ['#EDF3FF', '#F7FAFD', '#F5F7FB'] as const,
  header: [dynamic('rgba(47, 107, 255, 0.12)', 'rgba(56, 189, 248, 0.3)'), dynamic('rgba(15, 157, 143, 0.1)', 'rgba(45, 212, 191, 0.2)')] as const,
};
