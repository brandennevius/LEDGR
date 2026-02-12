import { DarkTheme, type Theme } from '@react-navigation/native';

import { colors, gradients } from './theme/colors';

export const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.cardBorder,
    notification: colors.accent,
  },
};

export { colors, gradients };

export const theme = {
  colors,
  gradients,
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    sm: 12,
    md: 20,
    lg: 28,
  },
};
