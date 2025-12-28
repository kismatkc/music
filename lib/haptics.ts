// lib/haptics.ts
// Haptic feedback wrapper with safe fallbacks

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { isFeatureEnabled } from './featureFlags';

type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/**
 * Trigger haptic feedback safely with feature flag and platform checks
 */
export const triggerHaptic = async (type: HapticType = 'light'): Promise<void> => {
  // Check feature flag
  if (!isFeatureEnabled('ENABLE_HAPTICS')) return;

  // Only on iOS for now (Android haptics can feel different)
  if (Platform.OS !== 'ios') return;

  try {
    switch (type) {
      case 'light':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  } catch (error) {
    // Silently fail - haptics are nice-to-have, not critical
    console.debug('Haptic feedback failed:', error);
  }
};
