import { DarkTheme, type Theme } from '@react-navigation/native';

import { colors } from './colors';

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

export { colors, gradients } from './colors';
