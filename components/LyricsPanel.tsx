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
import Toast from 'react-native-toast-message';
import { useMusic, updateSongLyrics, useProgress } from '@/lib/music-player-all-controls';

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

  // Lead % (user types 0..100; e.g. "4" => 4%)
  const [aheadPctStr, setAheadPctStr] = React.useState('');
  const aheadPctNum = Number.parseFloat(aheadPctStr);
  const aheadPctValid = Number.isFinite(aheadPctNum) && aheadPctNum >= 0 && aheadPctNum <= 100;
  const aheadFrac = aheadPctValid ? aheadPctNum / 100 : 0;

  // Auto-scroll toggle (effective only if % is valid)
  const [auto, setAuto] = React.useState(false);
  const autoEnabled = auto && aheadPctValid;

  // Settings modal (Lead % only)
  const [showConfig, setShowConfig] = React.useState(false);
  const inputRef = React.useRef<TextInput>(null);

  // list/bookkeeping for scroll mapping
  const listRef = React.useRef<FlatList<string>>(null);
  const contentH = React.useRef(0);
  const viewportH = React.useRef(0);
  const isUserDragging = React.useRef(false);

  // Track position
  const prog = useProgress();
  const duration = song?.duration || prog.duration || 0;

  // Reset per song
  React.useEffect(() => {
    setAheadPctStr('');
    setAuto(false);
    setShowConfig(false);
  }, [song?.id]);

  // Initial fetch
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

  // Cycle source
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

  // Auto-scroll driver
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
    setAuto(false); // manual scroll disables auto immediately
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
    const next = !auto;
    setAuto(next);
  };

  const confirmLeadAndClose = () => {
    // Validate & close
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
      {/* Header: title + settings gear */}
      <View style={styles.headerRow}>
        <Text numberOfLines={1} style={styles.title}>
          {song.title}
        </Text>
        <TouchableOpacity
          onPress={() => setShowConfig(true)}
          accessibilityLabel="Lyrics settings"
          style={styles.iconBtn}>
          <Ionicons name="settings-outline" size={18} color="#cbd5e1" />
        </TouchableOpacity>
      </View>

      {/* Controls row: Auto (left) | Change lyrics (right) */}
      <View style={styles.topControlsRow}>
        <TouchableOpacity
          onPress={toggleAuto}
          activeOpacity={0.85}
          style={[styles.toggleBtn, autoEnabled ? styles.toggleBtnOn : null]}>
          <Text style={[styles.toggleText, autoEnabled ? styles.toggleTextOn : null]}>
            {autoEnabled ? 'Auto (lead) ON' : 'Auto OFF'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={changeLyrics}
          disabled={loading}
          style={[styles.changeBtn, loading && { opacity: 0.6 }]}>
          <Text style={styles.changeText}>{loading ? 'Loading…' : 'Change lyrics'}</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {lyrics && lyrics.length ? (
        <FlatList
          ref={listRef}
          contentContainerStyle={{ paddingBottom: 8 }}
          data={lyrics}
          keyExtractor={(_, i) => `${song.id}-${i}`}
          renderItem={({ item }) => <Text style={styles.line}>{item || ' '}</Text>}
          onContentSizeChange={(_w, h) => (contentH.current = h)}
          onLayout={(e) => (viewportH.current = e.nativeEvent.layout.height)}
          onScrollBeginDrag={onScrollBeginDrag}
          onScrollEndDrag={onScrollEndDrag}
          scrollEventThrottle={16}
        />
      ) : (
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator color="#93c5fd" />
          ) : (
            <Text style={{ color: '#94a3b8' }}>No lyrics</Text>
          )}
        </View>
      )}

      {/* Settings modal — Lead % only + OK */}
      <Modal
        visible={showConfig}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfig(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lyrics settings</Text>
              <TouchableOpacity onPress={() => setShowConfig(false)} style={styles.iconBtn}>
                <Ionicons name="close" size={18} color="#cbd5e1" />
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
                  placeholderTextColor="#6b7280"
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
                  style={[styles.btn, styles.btnGhost]}>
                  <Text style={styles.btnGhostText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmLeadAndClose}
                  style={[styles.btn, styles.btnPrimary]}>
                  <Text style={styles.btnText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#273144',
    backgroundColor: '#0f141c',
    padding: 12,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10141c',
    borderWidth: 1,
    borderColor: '#273144',
  },

  title: { color: '#e5e7eb', fontWeight: '700', fontSize: 16 },

  // Auto (left) | Change Lyrics (right)
  topControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  toggleBtn: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0f141c',
    borderWidth: 1,
    borderColor: '#334155',
    alignSelf: 'flex-start',
  },
  toggleBtnOn: { backgroundColor: '#1e293b', borderColor: '#475569' },
  toggleText: { color: '#a7b1c2', fontWeight: '700' },
  toggleTextOn: { color: '#e5e7eb' },

  changeBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#334155',
  },
  changeText: { color: '#93c5fd', fontWeight: '700' },

  line: { color: '#cbd5e1', fontSize: 16, lineHeight: 24, marginBottom: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#0b1118',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#273144',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: { color: '#e5e7eb', fontSize: 16, fontWeight: '700' },

  controlsCard: {
    borderWidth: 1,
    borderColor: '#273144',
    backgroundColor: '#0f141c',
    borderRadius: 12,
    padding: 10,
    gap: 12,
  },

  kGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#0f141c',
    borderWidth: 1,
    borderColor: '#334155',
  },
  kLabel: { color: '#9aa0a6', fontSize: 12, fontWeight: '600' },
  kInput: {
    flex: 1,
    color: '#e8eaed',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
    fontVariant: ['tabular-nums'],
  },
  kInputError: { borderColor: '#ef4444' },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  btn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 90,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: '#4f46e5' },
  btnGhost: { borderWidth: 1, borderColor: '#39414f' },
  btnText: { color: '#fff', fontWeight: '600' },
  btnGhostText: { color: '#aab2c0', fontWeight: '600' },
});
