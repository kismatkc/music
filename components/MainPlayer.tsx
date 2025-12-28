// components/MainPlayer.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Slider from '@react-native-community/slider';
import * as Progress from 'react-native-progress';
import { Guitar } from 'lucide-react-native';
import Toast from 'react-native-toast-message';

import {
  useMusic,
  usePlayer,
  usePlayerStatus,
  togglePlayPause,
  startSeeking,
  updateSeekPosition,
  finishSeeking,
  cancelSeeking,
  Variant,
  hasStems,
  playSongById,
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

  // Get safe area insets to handle iPhone notch and home indicator
  const insets = useSafeAreaInsets();

  // Professional seeking state (local UI state)
  const [isSeekingLocal, setIsSeekingLocal] = useState(false);
  const [localSeekValue, setLocalSeekValue] = useState(0);

  // Combined seeking state
  const isSeeking = isSeekingState || isSeekingLocal;
  const displayPosition = isSeeking ? localSeekValue : position;

  // Professional play/pause with loading state
  const handleTogglePlayPause = useCallback(async () => {
    if (isLoading) return; // Prevent rapid clicking
    await togglePlayPause();
  }, [isLoading]);

  // Professional seeking handlers
  const handleSlidingStart = useCallback((value: number) => {
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

  // Professional skip controls with loading protection
  const handleSkipBack = useCallback(async () => {
    if (isLoading) return;
    await playPrev();
  }, [isLoading]);

  const handleSkipForward = useCallback(async () => {
    if (isLoading) return;
    await playNext();
  }, [isLoading]);

  // Professional seek forward/backward
  const handleSeekBack = useCallback(async () => {
    if (isLoading) return;
    const newTime = Math.max(0, position - 15);
    await seekTo(newTime);
  }, [isLoading, position]);

  const handleSeekForward = useCallback(async () => {
    if (isLoading) return;
    const newTime = Math.min(duration, position + 15);
    await seekTo(newTime);
  }, [isLoading, position, duration]);

  // Professional variant switching with loading protection
  const handleVariantSwitch = useCallback(
    async (v: Variant) => {
      if (isLoading) return; // Prevent switching during loading
      if (v !== 'full' && !hasStems(song)) return;
      await playVariantForCurrent(v);
    },
    [isLoading, song]
  );

  const stemsReady = hasStems(song);
  const [phase, setPhase] = useState<
    'idle' | 'uploading' | 'processing' | 'readyToDownload' | 'downloading'
  >('idle');
  const [pct, setPct] = useState(0);
  const inFlight = useRef<null | 'upload' | 'download'>(null);

  // If stems exist locally, collapse UI back to idle (unless a flow is running)
  useEffect(() => {
    if (!stemsReady) return;
    if (inFlight.current) return;
    if (phase !== 'idle') {
      setPhase('idle');
      setPct(0);
    }
  }, [stemsReady, phase]);

  // Bootstrap from server state on mount or when song changes
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
      } catch {
        // keep idle if we can't read state
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [song?.id, stemsReady]);

  // Poll processing progress
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
    <View style={[styles.wrap, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* header with proper safe area */}
      <View style={[styles.header, { marginTop: 8 }]}>
        <TouchableOpacity onPress={() => setShowFull(false)} style={styles.hBtn}>
          <Ionicons name="chevron-down" size={18} color="#cbd5e1" />
        </TouchableOpacity>
        <Text style={styles.hTitle}>Now Playing</Text>
        <View style={[styles.hBtn, { opacity: 0 }]} />
      </View>

      {/* lyrics fills available space */}
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        <LyricsPanel songId={song.id} />
      </View>

      {/* title/artist */}
      <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
        <Text style={styles.title} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {song.artist || 'Unknown artist'}
        </Text>
      </View>

      {/* slider */}
      <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
        <Slider
          style={{ width: '100%', height: 36 }}
          minimumValue={0}
          maximumValue={duration}
          value={displayPosition}
          onSlidingStart={handleSlidingStart}
          onValueChange={handleValueChange}
          onSlidingComplete={handleSlidingComplete}
          minimumTrackTintColor="#60A5FA"
          maximumTrackTintColor="#1E293B"
          thumbTintColor="#60A5FA"
        />
        <View style={styles.timeRow}>
          <Text style={styles.time}>{fmt(displayPosition)}</Text>
          <Text style={styles.time}>{fmt(duration)}</Text>
        </View>
      </View>

      {/* variants / extraction */}
      <View style={styles.variantArea}>
        {stemsReady ? (
          <View style={styles.variantRow}>
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
          </View>
        ) : (
          <View style={styles.extractCard}>
            {phase === 'idle' && (
              <TouchableOpacity
                onPress={startExtraction}
                style={styles.primaryBtn}
                disabled={!!inFlight.current}>
                <Text style={styles.primaryText}>Start extraction</Text>
              </TouchableOpacity>
            )}
            {phase === 'uploading' && (
              <View style={styles.progressRow}>
                <Progress.Bar
                  color="#60A5FA"
                  unfilledColor="#1E293B"
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
                  color="#60A5FA"
                  unfilledColor="#1E293B"
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
                disabled={!!inFlight.current}>
                <Text style={styles.primaryText}>Download stems</Text>
              </TouchableOpacity>
            )}
            {phase === 'downloading' && (
              <View style={styles.progressRow}>
                <Progress.Bar
                  color="#60A5FA"
                  unfilledColor="#1E293B"
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
          <Ionicons name="play-skip-back" size={26} color="#e2e8f0" />
        </Circle>
        <Circle onPress={handleSeekBack}>
          <Ionicons name="play-back" size={22} color="#e2e8f0" />
          <Text style={styles.small}>15</Text>
        </Circle>
        <Circle big onPress={handleTogglePlayPause} bg="#93c5fd">
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={30} color="#0b0f17" />
        </Circle>
        <Circle onPress={handleSeekForward}>
          <Ionicons name="play-forward" size={22} color="#e2e8f0" />
          <Text style={styles.small}>15</Text>
        </Circle>
        <Circle onPress={handleSkipForward}>
          <Ionicons name="play-skip-forward" size={26} color="#e2e8f0" />
        </Circle>
      </View>
    </View>
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
  const tint = active ? '#0b0f17' : '#e2e8f0';
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.variantBtn, active && styles.variantBtnActive]}>
      {icon === 'guitar' ? (
        <Guitar size={18} color={tint} />
      ) : (
        <Ionicons name={icon as IonName} size={18} color={tint} />
      )}
      <Text style={[styles.variantLabel, active && { color: '#0b0f17' }]}>{label}</Text>
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
      ]}>
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0b0f17',
  },
  header: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10141c',
    borderWidth: 1,
    borderColor: '#273144',
  },
  hTitle: { color: '#cbd5e1', fontWeight: '700' },
  title: { color: '#e5e7eb', fontWeight: '800', fontSize: 20 },
  sub: { color: '#9aa0a6', marginTop: 4 },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  time: { color: '#8ea0b5' },
  variantArea: { paddingHorizontal: 16, marginTop: 10 },
  variantRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  variantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#10141c',
    borderWidth: 1,
    borderColor: '#273144',
  },
  variantBtnActive: { backgroundColor: '#93c5fd', borderColor: '#93c5fd' },
  variantLabel: { color: '#e2e8f0', fontWeight: '600', fontSize: 13 },
  extractCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#273144',
    backgroundColor: '#0f141c',
  },
  primaryBtn: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryText: { color: '#93c5fd', fontWeight: '700' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pct: { color: '#93c5fd', fontWeight: '700' },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 24,
  },
  ctrl: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10141c',
    borderWidth: 1,
    borderColor: '#273144',
  },
  small: {
    position: 'absolute',
    bottom: 8,
    right: 10,
    color: '#cbd5e1',
    fontSize: 11,
  },
});
