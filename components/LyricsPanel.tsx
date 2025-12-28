// components/LyricsPanel.tsx

import * as React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  NativeScrollEvent,
  NativeSyntheticEvent,
  TextInput,
  Modal,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { useMusic, updateSongLyrics, useProgress } from '@/lib/music-player-all-controls';
import { tokens, pressOpacity, timing } from '@/lib/tokens';

/** Backend base */
const RAW = (process.env.EXPO_PUBLIC_BACKEND_URL as string) || 'http://localhost:3000';
const BASE = RAW.replace(/\/+$/, '');

async function fetchLyrics(songName: string, linkIndex: string): Promise<string[]> {
  const u = `${BASE}/scraper/scrape-lyrics?songName=${encodeURIComponent(
    songName
  )}&linkIndex=${encodeURIComponent(linkIndex)}`;
  const r = await fetch(u);
  if (!r.ok) throw new Error(`Lyrics fetch failed: ${r.status}`);
  const j = (await r.json()) as any;
  return (j?.lyrics ?? []) as string[];
}

/** progress p → lead-adjusted p'  (p' = p + k*(1-p)), k is FRACTION (0..1) */
const aheadMap = (p: number, kFrac: number) => {
  const pp = Math.max(0, Math.min(1, p));
  const kk = Math.max(0, Math.min(1, kFrac || 0));
  return Math.min(1, pp + kk * (1 - pp));
};

export default function LyricsPanel({ songId }: { songId: string }) {
  const song = useMusic((s) => s.songs.find((x) => x.id === songId));
  const [lyrics, setLyrics] = React.useState<string[] | null>(song?.lyrics ?? null);
  const [loading, setLoading] = React.useState(false);
  const [idx, setIdx] = React.useState(0);

  const [aheadPctStr, setAheadPctStr] = React.useState('');
  const aheadPctNum = Number.parseFloat(aheadPctStr);
  const aheadPctValid = Number.isFinite(aheadPctNum) && aheadPctNum >= 0 && aheadPctNum <= 100;
  const aheadFrac = aheadPctValid ? aheadPctNum / 100 : 0;

  const [auto, setAuto] = React.useState(false);
  const autoEnabled = auto && aheadPctValid;

  const [showConfig, setShowConfig] = React.useState(false);
  const inputRef = React.useRef<TextInput>(null);

  const listRef = React.useRef<FlatList<string>>(null);
  const contentH = React.useRef(0);
  const viewportH = React.useRef(0);
  const isUserDragging = React.useRef(false);

  const prog = useProgress();
  const duration = song?.duration || prog.duration || 0;

  // Reset per song
  React.useEffect(() => {
    setAheadPctStr('');
    setAuto(false);
    setShowConfig(false);
  }, [song?.id]);

  // Initial fetch - UNCHANGED
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!song?.title) return;
      if (song.lyrics && song.lyrics.length) {
        setLyrics(song.lyrics);
        return;
      }
      setLoading(true);
      try {
        const fresh = await fetchLyrics(song.title, '0');
        if (!cancelled) {
          setLyrics(fresh);
          await updateSongLyrics({ id: song.id, lyrics: fresh });
        }
      } catch (e) {
        !cancelled &&
          Toast.show({
            type: 'error',
            text1: 'Lyrics',
            text2: (e as Error).message,
          });
      } finally {
        !cancelled && setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [song?.id]);

  // Cycle source - UNCHANGED
  const changeLyrics = React.useCallback(async () => {
    if (!song?.title) return;
    const next = (idx + 1) % 7;
    setIdx(next);
    setLoading(true);
    try {
      const fresh = await fetchLyrics(song.title, String(next));
      setLyrics(fresh);
      await updateSongLyrics({ id: song.id, lyrics: fresh });
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: 'Lyrics',
        text2: (e as Error).message,
      });
    } finally {
      setLoading(false);
    }
  }, [song?.id, song?.title, idx]);

  // Auto-scroll driver - UNCHANGED
  React.useEffect(() => {
    if (!autoEnabled) return;
    if (!duration || !lyrics?.length) return;
    if (isUserDragging.current) return;

    const p = Math.max(0, Math.min(1, prog.position / duration));
    const pLead = aheadMap(p, aheadFrac);

    const maxY = Math.max(0, contentH.current - viewportH.current);
    const y = Math.max(0, Math.min(maxY, pLead * maxY));

    listRef.current?.scrollToOffset({ offset: y, animated: true });
  }, [autoEnabled, aheadFrac, prog.position, duration, lyrics?.length]);

  if (!song) return null;

  const onScrollBeginDrag = () => {
    isUserDragging.current = true;
    setAuto(false);
  };
  const onScrollEndDrag = (_e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isUserDragging.current = false;
  };

  const toggleAuto = () => {
    if (!aheadPctValid && !auto) {
      Toast.show({
        type: 'info',
        text1: 'Set a valid lead first',
        text2: 'Enter a number between 0 and 100, e.g. 4',
      });
      return;
    }
    setAuto(!auto);
  };

  const confirmLeadAndClose = () => {
    if (!aheadPctValid) {
      Toast.show({
        type: 'info',
        text1: 'Invalid lead %',
        text2: 'Enter a number between 0 and 100',
      });
      return;
    }
    inputRef.current?.blur();
    setShowConfig(false);
  };

  return (
    <View style={styles.wrap}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text numberOfLines={1} style={styles.title}>
          {song.title}
        </Text>
        <TouchableOpacity
          onPress={() => setShowConfig(true)}
          accessibilityLabel="Lyrics settings"
          style={styles.iconBtn}
          activeOpacity={pressOpacity.default}>
          <Ionicons name="settings-outline" size={18} color={tokens.colors.text.tertiary} />
        </TouchableOpacity>
      </View>

      {/* Controls */}
      <View style={styles.topControlsRow}>
        <TouchableOpacity
          onPress={toggleAuto}
          activeOpacity={pressOpacity.default}
          style={[styles.toggleBtn, autoEnabled ? styles.toggleBtnOn : null]}>
          <Text style={[styles.toggleText, autoEnabled ? styles.toggleTextOn : null]}>
            {autoEnabled ? 'Auto (lead) ON' : 'Auto OFF'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={changeLyrics}
          disabled={loading}
          style={[styles.changeBtn, loading && { opacity: 0.6 }]}
          activeOpacity={pressOpacity.default}>
          <Text style={styles.changeText}>{loading ? 'Loading…' : 'Change lyrics'}</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {lyrics && lyrics.length ? (
        <FlatList
          ref={listRef}
          contentContainerStyle={{ paddingBottom: tokens.spacing.sm }}
          data={lyrics}
          keyExtractor={(_, i) => `${song.id}-${i}`}
          renderItem={({ item, index }) => (
            <Animated.Text
              entering={FadeInDown.delay(index * 15).duration(timing.fast)}
              style={styles.line}>
              {item || ' '}
            </Animated.Text>
          )}
          onContentSizeChange={(_w, h) => (contentH.current = h)}
          onLayout={(e) => (viewportH.current = e.nativeEvent.layout.height)}
          onScrollBeginDrag={onScrollBeginDrag}
          onScrollEndDrag={onScrollEndDrag}
          scrollEventThrottle={16}
        />
      ) : (
        <Animated.View entering={FadeIn.duration(timing.normal)} style={styles.center}>
          {loading ? (
            <>
              <ActivityIndicator color={tokens.colors.accent.secondary} />
              <Text style={styles.loadingText}>Fetching lyrics...</Text>
            </>
          ) : (
            <Text style={styles.placeholderText}>No lyrics</Text>
          )}
        </Animated.View>
      )}

      {/* Settings modal */}
      <Modal
        visible={showConfig}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfig(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeInDown.duration(timing.normal)} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lyrics settings</Text>
              <TouchableOpacity
                onPress={() => setShowConfig(false)}
                style={styles.iconBtn}
                activeOpacity={pressOpacity.default}>
                <Ionicons name="close" size={18} color={tokens.colors.text.tertiary} />
              </TouchableOpacity>
            </View>

            <View style={styles.controlsCard}>
              <View style={styles.kGroup}>
                <Text style={styles.kLabel}>Lead %</Text>
                <TextInput
                  ref={inputRef}
                  value={aheadPctStr}
                  onChangeText={(t) => {
                    const cleaned = t.replace(',', '.').replace(/[^0-9.]/g, '');
                    setAheadPctStr(cleaned);
                  }}
                  placeholder="4"
                  placeholderTextColor={tokens.colors.text.muted}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  style={[
                    styles.kInput,
                    aheadPctStr.length > 0 && !aheadPctValid ? styles.kInputError : null,
                  ]}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setShowConfig(false)}
                  style={[styles.btn, styles.btnGhost]}
                  activeOpacity={pressOpacity.default}>
                  <Text style={styles.btnGhostText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmLeadAndClose}
                  style={[styles.btn, styles.btnPrimary]}
                  activeOpacity={pressOpacity.default}>
                  <Text style={styles.btnText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 220,
    borderRadius: tokens.radius.xxl,
    borderWidth: 1,
    borderColor: tokens.colors.border.strong,
    backgroundColor: tokens.colors.bg.tertiary,
    padding: tokens.spacing.md,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.sm,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.bg.tertiary,
    borderWidth: 1,
    borderColor: tokens.colors.border.strong,
  },

  title: {
    color: tokens.colors.text.primary,
    fontWeight: tokens.fontWeight.bold,
    fontSize: tokens.fontSize.lg,
  },

  topControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.md,
  },

  toggleBtn: {
    borderRadius: tokens.radius.full,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    backgroundColor: tokens.colors.bg.tertiary,
    borderWidth: 1,
    borderColor: tokens.colors.border.focus,
    alignSelf: 'flex-start',
  },
  toggleBtnOn: {
    backgroundColor: tokens.colors.bg.secondary,
    borderColor: tokens.colors.border.strong,
  },
  toggleText: {
    color: tokens.colors.text.tertiary,
    fontWeight: tokens.fontWeight.bold,
    fontSize: tokens.fontSize.sm,
  },
  toggleTextOn: { color: tokens.colors.text.primary },

  changeBtn: {
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    backgroundColor: tokens.colors.bg.secondary,
    borderWidth: 1,
    borderColor: tokens.colors.border.focus,
  },
  changeText: {
    color: tokens.colors.accent.secondary,
    fontWeight: tokens.fontWeight.bold,
    fontSize: tokens.fontSize.sm,
  },

  line: {
    color: tokens.colors.text.tertiary,
    fontSize: tokens.fontSize.lg,
    lineHeight: 24,
    marginBottom: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.md,
  },
  loadingText: {
    color: tokens.colors.accent.secondary,
    fontSize: tokens.fontSize.base,
  },
  placeholderText: {
    color: tokens.colors.text.muted,
    fontSize: tokens.fontSize.base,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: tokens.colors.overlay,
    justifyContent: 'center',
    padding: tokens.spacing.lg,
  },
  modalCard: {
    backgroundColor: tokens.colors.bg.primary,
    borderRadius: tokens.radius.xxl,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.strong,
    ...tokens.shadow.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.sm,
  },
  modalTitle: {
    color: tokens.colors.text.primary,
    fontSize: tokens.fontSize.lg,
    fontWeight: tokens.fontWeight.bold,
  },

  controlsCard: {
    borderWidth: 1,
    borderColor: tokens.colors.border.strong,
    backgroundColor: tokens.colors.bg.tertiary,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },

  kGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    backgroundColor: tokens.colors.bg.tertiary,
    borderWidth: 1,
    borderColor: tokens.colors.border.focus,
  },
  kLabel: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.fontSize.sm,
    fontWeight: tokens.fontWeight.medium,
  },
  kInput: {
    flex: 1,
    color: tokens.colors.text.primary,
    paddingVertical: 6,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.colors.border.focus,
    backgroundColor: tokens.colors.bg.secondary,
    fontVariant: ['tabular-nums'],
    fontSize: tokens.fontSize.base,
  },
  kInputError: { borderColor: tokens.colors.error },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tokens.spacing.md,
  },
  btn: {
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    minWidth: 90,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: tokens.colors.accent.button },
  btnGhost: {
    borderWidth: 1,
    borderColor: tokens.colors.border.focus,
  },
  btnText: {
    color: '#fff',
    fontWeight: tokens.fontWeight.medium,
    fontSize: tokens.fontSize.base,
  },
  btnGhostText: {
    color: tokens.colors.text.tertiary,
    fontWeight: tokens.fontWeight.medium,
    fontSize: tokens.fontSize.base,
  },
});
