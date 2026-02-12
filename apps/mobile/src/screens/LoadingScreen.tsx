import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Screen } from '../components/Screen';
import { colors } from '../theme';

export function LoadingScreen() {
  return (
    <Screen>
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
