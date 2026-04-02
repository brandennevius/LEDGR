import { DefaultTheme, type Theme } from '@react-navigation/native';

import { colors } from './colors';

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

export { colors, gradients } from './colors';
