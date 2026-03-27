import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEMO_MODE_KEY = 'settings.demoModeEnabled';

export async function getDemoModeEnabled() {
  try {
    return (await AsyncStorage.getItem(DEMO_MODE_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setDemoModeEnabled(enabled: boolean) {
  await AsyncStorage.setItem(DEMO_MODE_KEY, enabled ? 'true' : 'false');
}
