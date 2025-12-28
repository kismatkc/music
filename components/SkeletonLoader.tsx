// components/SkeletonLoader.tsx
// Shimmer skeleton loader for Songs screen

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { tokens } from '@/lib/tokens';

const SkeletonRow = () => {
  const shimmer = useSharedValue(0);

  React.useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.linear }), -1, false);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + shimmer.value * 0.4,
  }));

  return (
    <View style={styles.row}>
      <Animated.View style={[styles.art, animatedStyle]} />
      <View style={styles.meta}>
        <Animated.View style={[styles.titleSkeleton, animatedStyle]} />
        <Animated.View style={[styles.subSkeleton, animatedStyle]} />
      </View>
      <Animated.View style={[styles.durationSkeleton, animatedStyle]} />
    </View>
  );
};

export const SongsSkeleton = () => {
  return (
    <View style={styles.container}>
      {[...Array(8)].map((_, i) => (
        <React.Fragment key={i}>
          <SkeletonRow />
          {i < 7 && <View style={styles.sep} />}
        </React.Fragment>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: tokens.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.bg.secondary,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
  },
  art: {
    width: 52,
    height: 52,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.border.default,
  },
  meta: {
    flex: 1,
    marginLeft: tokens.spacing.md,
    gap: 6,
  },
  titleSkeleton: {
    height: 16,
    backgroundColor: tokens.colors.border.default,
    borderRadius: 4,
    width: '70%',
  },
  subSkeleton: {
    height: 12,
    backgroundColor: tokens.colors.border.default,
    borderRadius: 4,
    width: '50%',
  },
  durationSkeleton: {
    width: 40,
    height: 12,
    backgroundColor: tokens.colors.border.default,
    borderRadius: 4,
    marginLeft: tokens.spacing.sm,
  },
  sep: {
    height: tokens.spacing.sm,
  },
});
