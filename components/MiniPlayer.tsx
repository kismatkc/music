// components/MiniPlayer.tsx

import React, { useCallback, useMemo } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Slider from '@react-native-community/slider';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import {
  useMusic,
  usePlayer,
  usePlayerStatus,
  togglePlayPause,
  playNext,
  playPrev,
} from '@/lib/music-player-all-controls';
import { tokens, pressOpacity } from '@/lib/tokens';
import { triggerHaptic } from '@/lib/haptics';

const defaultArtwork = require('../assets/unknown_artist.png');

const fmt = (sec?: number) => {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
};

export default function MiniPlayer({ style }: { style?: ViewStyle }) {
  const currentId = usePlayer((s) => s.currentId);
  const showFull = usePlayer((s) => s.showFull);
  const setShowFull = usePlayer((s) => s.setShowFull);

  const { isPlaying, isLoading, duration, position } = usePlayerStatus();

  const songs = useMusic((s) => s.songs);
  const song = useMemo(
    () => (currentId ? songs.find((x) => x.id === currentId) || null : null),
    [songs, currentId]
  );

  const hidden = !song || !!showFull;

  const handleToggle = useCallback(async () => {
    if (isLoading) return;
    await triggerHaptic('medium');
    await togglePlayPause();
  }, [isLoading]);

  const handleSkipBack = useCallback(async () => {
    if (isLoading) return;
    await triggerHaptic('light');
    await playPrev();
  }, [isLoading]);

  const handleSkipForward = useCallback(async () => {
    if (isLoading) return;
    await triggerHaptic('light');
    await playNext();
  }, [isLoading]);

  const handleOpenFull = useCallback(async () => {
    await triggerHaptic('light');
    setShowFull(true);
  }, [setShowFull]);

  if (hidden) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOutDown.duration(200)}
      style={[styles.shell, style]}>
      <TouchableOpacity
        style={styles.left}
        onPress={handleOpenFull}
        activeOpacity={pressOpacity.light}>
        <Image source={song?.artwork ? { uri: song.artwork } : defaultArtwork} style={styles.art} />
        <View style={{ flex: 1, paddingRight: 96 }}>
          <Text style={styles.title} numberOfLines={1}>
            {song?.title || '—'}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {song?.artist || 'Unknown artist'}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.right}>
        <TouchableOpacity
          onPress={handleSkipBack}
          style={[styles.iconBtn, isLoading && styles.disabled]}
          disabled={isLoading}
          activeOpacity={pressOpacity.default}>
          <Ionicons name="play-skip-back" size={20} color={tokens.colors.text.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleToggle}
          style={[styles.iconBtn, styles.play, isLoading && styles.loadingPlay]}
          disabled={isLoading}
          activeOpacity={pressOpacity.default}>
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={20}
            color={isLoading ? tokens.colors.text.muted : tokens.colors.text.inverse}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSkipForward}
          style={[styles.iconBtn, isLoading && styles.disabled]}
          disabled={isLoading}
          activeOpacity={pressOpacity.default}>
          <Ionicons name="play-skip-forward" size={20} color={tokens.colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* progress (read-only) */}
      <View style={styles.sliderRow} pointerEvents="none">
        <Slider
          style={{ flex: 1, height: 24 }}
          minimumValue={0}
          maximumValue={duration}
          value={position}
          minimumTrackTintColor={tokens.colors.accent.primary}
          maximumTrackTintColor={tokens.colors.bg.secondary}
          thumbTintColor={tokens.colors.accent.primary}
        />
        <Text style={styles.time}>{fmt(duration)}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginHorizontal: tokens.spacing.md,
    backgroundColor: tokens.colors.bg.elevated,
    borderRadius: tokens.radius.xxl,
    borderWidth: 1,
    borderColor: tokens.colors.border.default,
    padding: tokens.spacing.md,
    ...tokens.shadow.player,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md },
  art: {
    width: 42,
    height: 42,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.bg.tertiary,
  },
  title: {
    color: tokens.colors.text.primary,
    fontWeight: tokens.fontWeight.bold,
    fontSize: tokens.fontSize.md,
  },
  artist: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.fontSize.sm,
    marginTop: 2,
  },
  right: {
    position: 'absolute',
    right: tokens.spacing.md,
    top: tokens.spacing.md,
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    borderColor: tokens.colors.border.default,
    backgroundColor: tokens.colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    backgroundColor: tokens.colors.accent.primary,
    borderColor: tokens.colors.accent.primary,
  },
  disabled: { opacity: tokens.opacity.disabled },
  loadingPlay: {
    backgroundColor: tokens.colors.disabled,
    borderColor: tokens.colors.disabled,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginTop: 6,
  },
  time: {
    color: tokens.colors.text.tertiary,
    fontSize: tokens.fontSize.xs,
    width: 44,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
