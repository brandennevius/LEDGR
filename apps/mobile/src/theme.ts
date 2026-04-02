import { DefaultTheme, type Theme } from '@react-navigation/native';

import { colors, gradients } from './theme/colors';

export const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary as unknown as string,
    background: colors.background as unknown as string,
    card: colors.surface as unknown as string,
    text: colors.text as unknown as string,
    border: colors.cardBorder as unknown as string,
    notification: colors.accent as unknown as string,
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
