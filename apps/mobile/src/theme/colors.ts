import { DynamicColorIOS, Platform } from 'react-native';

const dynamic = (light: string, dark: string) =>
  Platform.OS === 'ios' ? DynamicColorIOS({ light, dark }) : dark;

export const colors = {
  background: dynamic('#FFFFFF', '#0B0F1E'),
  backgroundAlt: dynamic('#F2F5FF', '#11162B'),
  surface: dynamic('#FFFFFF', '#151B34'),
  card: dynamic('rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.08)'),
  cardBorder: dynamic('rgba(13, 26, 53, 0.12)', 'rgba(255, 255, 255, 0.06)'),
  chrome: dynamic('rgba(111, 89, 232, 0.97)', 'rgba(8, 14, 32, 0.96)'),
  chromeText: dynamic('#F4F7FF', '#E6E9F2'),
  chromeButtonBg: dynamic('rgba(255, 255, 255, 0.18)', 'rgba(255, 255, 255, 0.08)'),
  chromeButtonBorder: dynamic('rgba(255, 255, 255, 0.38)', 'rgba(255, 255, 255, 0.14)'),
  elevated: dynamic('rgba(255, 255, 255, 0.92)', 'rgba(255, 255, 255, 0.06)'),
  inputBg: dynamic('rgba(255, 255, 255, 0.96)', 'rgba(9, 13, 27, 0.7)'),
  backdrop: dynamic('rgba(19, 43, 90, 0.22)', 'rgba(9, 12, 18, 0.65)'),
  userBubble: dynamic('rgba(14, 165, 233, 0.2)', 'rgba(114, 92, 255, 0.25)'),
  assistantBubble: dynamic('rgba(13, 26, 53, 0.06)', 'rgba(255, 255, 255, 0.06)'),
  progressTrack: dynamic('#DCE2EC', 'rgba(255, 255, 255, 0.08)'),
  text: dynamic('#10213F', '#E6E9F2'),
  textMuted: dynamic('#4D5E80', '#A7B0C2'),
  primary: dynamic('#0EA5E9', '#38BDF8'),
  accent: dynamic('#D97706', '#F59E0B'),
  success: dynamic('#16A34A', '#22C55E'),
  danger: dynamic('#DC2626', '#F87171'),
};

export const gradients = {
  appDark: ['#0B0F1E', '#101734', '#0B0F1E'] as const,
  appLight: ['#6F59E8', '#B3A9FF', '#FFFFFF'] as const,
  header: [dynamic('rgba(14, 165, 233, 0.2)', 'rgba(56, 189, 248, 0.3)'), dynamic('rgba(217, 119, 6, 0.18)', 'rgba(245, 158, 11, 0.2)')] as const,
};
