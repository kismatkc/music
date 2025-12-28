// lib/featureFlags.ts
// Feature flag system for safe rollout of new features

type FeatureFlags = {
  ENABLE_HAPTICS: boolean;
  ENABLE_LIST_OPTIMIZATION: boolean;
  ENABLE_SKELETON_LOADER: boolean;
};

// Simple in-memory feature flags (can be extended to AsyncStorage or remote config)
const flags: FeatureFlags = {
  ENABLE_HAPTICS: true, // Safe - uses expo-haptics with fallbacks
  ENABLE_LIST_OPTIMIZATION: true, // Safe - FlatList perf improvements
  ENABLE_SKELETON_LOADER: true, // Safe - visual enhancement only
};

export const isFeatureEnabled = (flag: keyof FeatureFlags): boolean => {
  return flags[flag] ?? false;
};

// Helper to update flags at runtime (useful for testing)
export const setFeatureFlag = (flag: keyof FeatureFlags, value: boolean): void => {
  flags[flag] = value;
};
