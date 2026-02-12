import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { colors } from '../theme';

type PlaceholderScreenProps = {
  title?: string;
};

export default function PlaceholderScreen({ title = 'Coming soon' }: PlaceholderScreenProps) {
  return (
    <Screen title={title} subtitle="We're building this experience next.">
      <View style={styles.container}>
        <Text style={styles.title}>Stay tuned</Text>
        <Text style={styles.body}>This section will mirror the web app features soon.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
});
