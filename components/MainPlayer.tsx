// components/MainPlayer.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Slider from '@react-native-community/slider';
import * as Progress from 'react-native-progress';
import { Guitar } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import {
  useMusic,
  usePlayer,
  usePlayerStatus,
  togglePlayPause,
  startSeeking,
  updateSeekPosition,
  finishSeeking,
  Variant,
  hasStems,
  playVariantForCurrent,
  uploadForSeparation,
  pollStemsState,
  fetchStemsResult,
  downloadStemsToLibrary,
  playNext,
  playPrev,
  seekTo,
} from '@/lib/music-player-all-controls';

import LyricsPanel from './LyricsPanel';
import { tokens, pressOpacity, timing } from '@/lib/tokens';
import { triggerHaptic } from '@/lib/haptics';

const fmt = (sec: number) => {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
};

export default function MainPlayer() {
  const { currentId, showFull, setShowFull } = usePlayer();
  const {
    isPlaying,
    isLoading,
    isSeeking: isSeekingState,
    duration,
    position,
    activeVariant,
  } = usePlayerStatus();

  const songs = useMusic((s) => s.songs);
  const song = useMemo(() => songs.find((x) => x.id === currentId) || null, [songs, currentId]);

  const insets = useSafeAreaInsets();

  const [isSeekingLocal, setIsSeekingLocal] = useState(false);
  const [localSeekValue, setLocalSeekValue] = useState(0);

  const isSeeking = isSeekingState || isSeekingLocal;
  const displayPosition = isSeeking ? localSeekValue : position;

  const handleTogglePlayPause = useCallback(async () => {
    if (isLoading) return;
    await triggerHaptic('medium');
    await togglePlayPause();
  }, [isLoading]);

  const handleSlidingStart = useCallback((value: number) => {
    triggerHaptic('light');
    setIsSeekingLocal(true);
    setLocalSeekValue(value);
    startSeeking(value);
  }, []);

  const handleValueChange = useCallback((value: number) => {
    setLocalSeekValue(value);
    updateSeekPosition(value);
  }, []);

  const handleSlidingComplete = useCallback(async (value: number) => {
    setLocalSeekValue(value);
    setIsSeekingLocal(false);
    await finishSeeking();
  }, []);

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

  const handleSeekBack = useCallback(async () => {
    if (isLoading) return;
    await triggerHaptic('light');
    const newTime = Math.max(0, position - 15);
    await seekTo(newTime);
  }, [isLoading, position]);

  const handleSeekForward = useCallback(async () => {
    if (isLoading) return;
    await triggerHaptic('light');
    const newTime = Math.min(duration, position + 15);
    await seekTo(newTime);
  }, [isLoading, position, duration]);

  const handleVariantSwitch = useCallback(
    async (v: Variant) => {
      if (isLoading) return;
      if (v !== 'full' && !hasStems(song)) return;
      await triggerHaptic('light');
      await playVariantForCurrent(v);
    },
    [isLoading, song]
  );

  const handleClose = useCallback(async () => {
    await triggerHaptic('light');
    setShowFull(false);
  }, [setShowFull]);

  const stemsReady = hasStems(song);
  const [phase, setPhase] = useState<
    'idle' | 'uploading' | 'processing' | 'readyToDownload' | 'downloading'
  >('idle');
  const [pct, setPct] = useState(0);
  const inFlight = useRef<null | 'upload' | 'download'>(null);

  useEffect(() => {
    if (!stemsReady) return;
    if (inFlight.current) return;
    if (phase !== 'idle') {
      setPhase('idle');
      setPct(0);
    }
  }, [stemsReady, phase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!song?.id || stemsReady) return;
      try {
        const s = await pollStemsState(song.id);
        if (cancelled) return;
        if (s.ready) {
          setPhase('readyToDownload');
          setPct(100);
        } else if (s.state && s.state !== 'not_found') {
          setPhase('processing');
          setPct(Math.max(0, Math.min(100, s.progress ?? 0)));
        } else {
          setPhase('idle');
          setPct(0);
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [song?.id, stemsReady]);

  useEffect(() => {
    if (!song?.id || phase !== 'processing') return;
    let mounted = true;
    const t = setInterval(async () => {
      try {
        const s = await pollStemsState(song.id);
        if (!mounted) return;
        setPct((p) => Math.max(p, s.progress || 0));
        if (s.ready) setPhase('readyToDownload');
      } catch {}
    }, 2000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [phase, song?.id]);

  const startExtraction = useCallback(async () => {
    if (!song || inFlight.current) return;

    try {
      const s = await pollStemsState(song.id);
      if (s.ready) {
        setPhase('readyToDownload');
        setPct(100);
        return;
      }
      if (s.state && s.state !== 'not_found') {
        setPhase('processing');
        setPct(Math.max(0, Math.min(100, s.progress ?? 0)));
        return;
      }
    } catch {}

    inFlight.current = 'upload';
    setPhase('uploading');
    setPct(1);
    try {
      await uploadForSeparation(song.id, (p) => setPct(p));
      setPhase('processing');
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: 'Upload',
        text2: (e as Error).message,
      });
      setPhase('idle');
      setPct(0);
    } finally {
      inFlight.current = null;
    }
  }, [song?.id]);

  const saveStems = useCallback(async () => {
    if (!song || inFlight.current) return;
    inFlight.current = 'download';
    setPhase('downloading');
    try {
      let tries = 0;
      while (tries < 20) {
        const r = await fetchStemsResult(song.id);
        if (r.ready && r.available && r.vocalsUrl && (r.instrumentalUrl || r.accompanimentUrl)) {
          await downloadStemsToLibrary({
            id: song.id,
            vocalsUrl: r.vocalsUrl,
            instrumentalUrl: r.instrumentalUrl || (r.accompanimentUrl as string),
          });
          break;
        }
        await new Promise((r) => setTimeout(r, 1200));
        tries++;
      }
      setPhase('idle');
      setPct(0);
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: 'Download',
        text2: (e as Error).message,
      });
      setPhase('readyToDownload');
    } finally {
      inFlight.current = null;
    }
  }, [song?.id]);

  if (!showFull || !song) return null;

  return (
    <Animated.View
      entering={SlideInDown.duration(timing.slow)}
      exiting={SlideOutDown.duration(timing.normal)}
      style={[styles.wrap, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* header */}
      <View style={[styles.header, { marginTop: tokens.spacing.sm }]}>
        <TouchableOpacity
          onPress={handleClose}
          style={styles.hBtn}
          activeOpacity={pressOpacity.default}>
          <Ionicons name="chevron-down" size={18} color={tokens.colors.text.tertiary} />
        </TouchableOpacity>
        <Text style={styles.hTitle}>Now Playing</Text>
        <View style={[styles.hBtn, { opacity: 0 }]} />
      </View>

      {/* lyrics fills available space */}
      <View style={{ flex: 1, paddingHorizontal: tokens.spacing.lg }}>
        <LyricsPanel songId={song.id} />
      </View>

      {/* title/artist */}
      <View style={{ paddingHorizontal: tokens.spacing.xl, marginTop: tokens.spacing.md }}>
        <Text style={styles.title} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {song.artist || 'Unknown artist'}
        </Text>
      </View>

      {/* slider */}
      <View style={{ paddingHorizontal: tokens.spacing.xl, marginTop: tokens.spacing.md }}>
        <Slider
          style={{ width: '100%', height: 36 }}
          minimumValue={0}
          maximumValue={duration}
          value={displayPosition}
          onSlidingStart={handleSlidingStart}
          onValueChange={handleValueChange}
          onSlidingComplete={handleSlidingComplete}
          minimumTrackTintColor={tokens.colors.accent.primary}
          maximumTrackTintColor={tokens.colors.bg.secondary}
          thumbTintColor={tokens.colors.accent.primary}
        />
        <View style={styles.timeRow}>
          <Text style={styles.time}>{fmt(displayPosition)}</Text>
          <Text style={styles.time}>{fmt(duration)}</Text>
        </View>
      </View>

      {/* variants / extraction */}
      <View style={styles.variantArea}>
        {stemsReady ? (
          <Animated.View entering={FadeIn.duration(timing.normal)} style={styles.variantRow}>
            <VariantBtn
              label="Music"
              icon="musical-notes"
              active={activeVariant === 'full'}
              onPress={() => handleVariantSwitch('full')}
            />
            <VariantBtn
              label="Mic"
              icon="mic"
              active={activeVariant === 'vocals'}
              onPress={() => handleVariantSwitch('vocals')}
            />
            <VariantBtn
              label="Guitar"
              icon="guitar"
              active={activeVariant === 'instrumental'}
              onPress={() => handleVariantSwitch('instrumental')}
            />
          </Animated.View>
        ) : (
          <View style={styles.extractCard}>
            {phase === 'idle' && (
              <TouchableOpacity
                onPress={startExtraction}
                style={styles.primaryBtn}
                disabled={!!inFlight.current}
                activeOpacity={pressOpacity.default}>
                <Text style={styles.primaryText}>Start extraction</Text>
              </TouchableOpacity>
            )}
            {phase === 'uploading' && (
              <View style={styles.progressRow}>
                <Progress.Bar
                  color={tokens.colors.accent.primary}
                  unfilledColor={tokens.colors.bg.secondary}
                  borderWidth={0}
                  width={220}
                  progress={pct / 100}
                />
                <Text style={styles.pct}>{pct}%</Text>
              </View>
            )}
            {phase === 'processing' && (
              <View style={styles.progressRow}>
                <Progress.Bar
                  color={tokens.colors.accent.primary}
                  unfilledColor={tokens.colors.bg.secondary}
                  borderWidth={0}
                  width={220}
                  progress={pct > 0 ? pct / 100 : 0}
                  indeterminate={pct <= 0}
                />
                <Text style={styles.pct}>{pct > 0 ? `Separating… ${pct}%` : 'Separating…'}</Text>
              </View>
            )}
            {phase === 'readyToDownload' && (
              <TouchableOpacity
                onPress={saveStems}
                style={styles.primaryBtn}
                disabled={!!inFlight.current}
                activeOpacity={pressOpacity.default}>
                <Text style={styles.primaryText}>Download stems</Text>
              </TouchableOpacity>
            )}
            {phase === 'downloading' && (
              <View style={styles.progressRow}>
                <Progress.Bar
                  color={tokens.colors.accent.primary}
                  unfilledColor={tokens.colors.bg.secondary}
                  borderWidth={0}
                  width={220}
                  indeterminate
                />
                <Text style={styles.pct}>Saving…</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* transport controls */}
      <View style={styles.controlsRow}>
        <Circle onPress={handleSkipBack}>
          <Ionicons name="play-skip-back" size={26} color={tokens.colors.text.primary} />
        </Circle>
        <Circle onPress={handleSeekBack}>
          <Ionicons name="play-back" size={22} color={tokens.colors.text.primary} />
          <Text style={styles.small}>15</Text>
        </Circle>
        <Circle big onPress={handleTogglePlayPause} bg={tokens.colors.accent.secondary}>
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={30}
            color={tokens.colors.text.inverse}
          />
        </Circle>
        <Circle onPress={handleSeekForward}>
          <Ionicons name="play-forward" size={22} color={tokens.colors.text.primary} />
          <Text style={styles.small}>15</Text>
        </Circle>
        <Circle onPress={handleSkipForward}>
          <Ionicons name="play-skip-forward" size={26} color={tokens.colors.text.primary} />
        </Circle>
      </View>
    </Animated.View>
  );
}

type IonName = React.ComponentProps<typeof Ionicons>['name'];
function VariantBtn({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: IonName | 'guitar';
  active: boolean;
  onPress: () => void;
}) {
  const tint = active ? tokens.colors.text.inverse : tokens.colors.text.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.variantBtn, active && styles.variantBtnActive]}
      activeOpacity={pressOpacity.default}>
      {icon === 'guitar' ? (
        <Guitar size={18} color={tint} />
      ) : (
        <Ionicons name={icon as IonName} size={18} color={tint} />
      )}
      <Text style={[styles.variantLabel, active && { color: tokens.colors.text.inverse }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Circle({
  children,
  onPress,
  big,
  bg,
}: {
  children: React.ReactNode;
  onPress: () => void | Promise<void>;
  big?: boolean;
  bg?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.ctrl,
        big && { width: 80, height: 80 },
        bg ? { backgroundColor: bg, borderColor: bg } : null,
      ]}
      activeOpacity={pressOpacity.default}>
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: tokens.colors.bg.primary,
  },
  header: {
    height: 56,
    paddingHorizontal: tokens.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hBtn: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.bg.elevated,
    borderWidth: 1,
    borderColor: tokens.colors.border.default,
  },
  hTitle: {
    color: tokens.colors.text.secondary,
    fontWeight: tokens.fontWeight.semibold,
    fontSize: tokens.fontSize.base,
  },
  title: {
    color: tokens.colors.text.primary,
    fontWeight: tokens.fontWeight.extraBold,
    fontSize: tokens.fontSize.xxl,
    letterSpacing: -0.5,
  },
  sub: {
    color: tokens.colors.text.secondary,
    marginTop: tokens.spacing.xs,
    fontSize: tokens.fontSize.lg,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  time: {
    color: tokens.colors.text.tertiary,
    fontSize: tokens.fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  variantArea: {
    paddingHorizontal: tokens.spacing.lg,
    marginTop: tokens.spacing.lg,
  },
  variantRow: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    justifyContent: 'center',
  },
  variantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
    height: 40,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.colors.bg.elevated,
    borderWidth: 1,
    borderColor: tokens.colors.border.default,
  },
  variantBtnActive: {
    backgroundColor: tokens.colors.accent.primary,
    borderColor: tokens.colors.accent.primary,
  },
  variantLabel: {
    color: tokens.colors.text.primary,
    fontWeight: tokens.fontWeight.semibold,
    fontSize: tokens.fontSize.base,
  },
  extractCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.lg,
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    borderColor: tokens.colors.border.default,
    backgroundColor: tokens.colors.bg.elevated,
  },
  primaryBtn: {
    backgroundColor: tokens.colors.accent.primary,
    borderWidth: 1,
    borderColor: tokens.colors.accent.primary,
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radius.lg,
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: tokens.fontWeight.bold,
    fontSize: tokens.fontSize.base,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  pct: {
    color: tokens.colors.text.secondary,
    fontWeight: tokens.fontWeight.medium,
    fontSize: tokens.fontSize.base,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.xl,
    paddingBottom: tokens.spacing.xxl,
  },
  ctrl: {
    width: 64,
    height: 64,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.bg.elevated,
    borderWidth: 1,
    borderColor: tokens.colors.border.default,
  },
  small: {
    position: 'absolute',
    bottom: 8,
    right: 10,
    color: tokens.colors.text.tertiary,
    fontSize: tokens.fontSize.xs,
    fontWeight: tokens.fontWeight.semibold,
  },
});
