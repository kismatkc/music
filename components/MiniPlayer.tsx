// components/MiniPlayer.tsx

import React, { useCallback, useMemo } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Slider from '@react-native-community/slider';

import {
  useMusic,
  usePlayer,
  usePlayerStatus,
  togglePlayPause,
  playNext,
  playPrev,
} from '@/lib/music-player-all-controls';

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

  // Professional mini player controls with loading protection
  const handleToggle = useCallback(async () => {
    if (isLoading) return; // Prevent rapid clicking
    await togglePlayPause();
  }, [isLoading]);

  const handleSkipBack = useCallback(async () => {
    if (isLoading) return;
    await playPrev();
  }, [isLoading]);

  const handleSkipForward = useCallback(async () => {
    if (isLoading) return;
    await playNext();
  }, [isLoading]);

  return (
    <View
      pointerEvents={hidden ? 'none' : 'auto'}
      style={[styles.shell, style, hidden && styles.hidden]}>
      <TouchableOpacity style={styles.left} onPress={() => setShowFull(true)} activeOpacity={0.9}>
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
          disabled={isLoading}>
          <Ionicons name="play-skip-back" size={20} color="#e2e8f0" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleToggle}
          style={[styles.iconBtn, styles.play, isLoading && styles.loadingPlay]}
          disabled={isLoading}>
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={20}
            color={isLoading ? '#6b7280' : '#0b0f17'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSkipForward}
          style={[styles.iconBtn, isLoading && styles.disabled]}
          disabled={isLoading}>
          <Ionicons name="play-skip-forward" size={20} color="#e2e8f0" />
        </TouchableOpacity>
      </View>

      {/* progress (read-only) */}
      <View style={styles.sliderRow} pointerEvents="none">
        <Slider
          style={{ flex: 1, height: 24 }}
          minimumValue={0}
          maximumValue={duration}
          value={position}
          minimumTrackTintColor="#60A5FA"
          maximumTrackTintColor="#1E293B"
          thumbTintColor="#60A5FA"
        />
        <Text style={styles.time}>{fmt(duration)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginHorizontal: 12,
    backgroundColor: '#0f141c',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#273144',
    padding: 10,
  },
  hidden: { display: 'none' },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  art: { width: 42, height: 42, borderRadius: 8, backgroundColor: '#11151c' },
  title: { color: '#e5e7eb', fontWeight: '700' },
  artist: { color: '#9aa0a6', fontSize: 12 },
  right: {
    position: 'absolute',
    right: 10,
    top: 10,
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#273144',
    backgroundColor: '#10141c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: { backgroundColor: '#93c5fd', borderColor: '#93c5fd' },
  disabled: { opacity: 0.5 },
  loadingPlay: { backgroundColor: '#64748b', borderColor: '#64748b' },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  time: { color: '#8ea0b5', fontSize: 11, width: 44, textAlign: 'right' },
});
