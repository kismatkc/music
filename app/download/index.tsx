// app/download/index.tsx

import { useNetworkState } from 'expo-network';
import * as React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { ensureInit, saveBase64AsSong, useMusic } from '@/lib/music-player-all-controls';
import NetworkCheckOvelay from '@/components/WifiWarningBanner';
import { tokens, pressOpacity, timing } from '@/lib/tokens';

const RAW_BASE = (process.env.EXPO_PUBLIC_BACKEND_URL as string) || 'http://localhost:3000';
const BASE = RAW_BASE.replace(/\/+$/, '');
const POLL_INTERVAL_MS = 1000;
const CLIENT_TIMEOUT_MS = 200_000;
const YT_REGEX =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w\-]{6,}/i;
const rid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

type Phase = 'idle' | 'valid' | 'starting' | 'inflight' | 'done' | 'error';

type DownloadResponse = {
  base64Buffer: string;
  title?: string;
  author?: string;
  id?: string;
};

export default function MusicDownloader() {
  const insets = useSafeAreaInsets();
  const { isInternetReachable } = useNetworkState();
  const [url, setUrl] = React.useState('');
  const [isValid, setIsValid] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [progress, setProgress] = React.useState(0);
  const [status, setStatus] = React.useState('Paste a YouTube link');
  const [meta, setMeta] = React.useState<{
    title?: string;
    author?: string;
    savedId?: string;
  }>();

  const inputRef = React.useRef<TextInput>(null);
  const controllerRef = React.useRef<AbortController | null>(null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshSongs = useMusic((s) => s.refresh);

  React.useEffect(() => {
    ensureInit().catch(() => {});
  }, []);

  React.useEffect(() => {
    const ok = YT_REGEX.test(url.trim());
    setIsValid(ok);
    setPhase(!url ? 'idle' : ok ? 'valid' : 'idle');
    setStatus(
      !url
        ? 'Paste a YouTube link'
        : ok
          ? 'Looks good — ready to convert.'
          : 'Enter a valid YouTube URL'
    );
  }, [url]);

  const labelForProgress = (p: number) =>
    p < 0.1
      ? 'Fetching metadata…'
      : p < 0.4
        ? 'Preparing conversion…'
        : p < 0.99
          ? 'Downloading audio…'
          : 'Finishing up…';

  function resetForm() {
    setUrl('');
    setMeta(undefined);
    setProgress(0);
    setStatus('Paste a YouTube link');
    setPhase('idle');
    inputRef.current?.focus();
  }

  async function startDownload() {
    if (!isValid || phase === 'inflight' || phase === 'starting') return;

    const id = rid();
    setPhase('starting');
    setProgress(0);
    setStatus('Starting…');

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${BASE}/progress/${id}`);
        const j = (await r.json()) as { progress?: number };
        const p = Math.max(0, Math.min(1, Number(j.progress ?? 0)));
        setProgress(p);
        setStatus(labelForProgress(p));
      } catch {}
    }, POLL_INTERVAL_MS);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      cancelDownload();
      setPhase('error');
      setStatus('Client timeout. Please try again.');
    }, CLIENT_TIMEOUT_MS);

    setPhase('inflight');
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();

    try {
      const u = `${BASE}/scraper/download-mp3?url=${encodeURIComponent(
        url.trim()
      )}&id=${encodeURIComponent(id)}`;
      const resp = await fetch(u, { signal: controllerRef.current.signal });
      const data = await parseJsonSafe<DownloadResponse>(resp);

      if (!data.base64Buffer) throw new Error('Empty audio payload from server.');

      const saved = await saveBase64AsSong({
        base64: data.base64Buffer,
        title: data.title || 'Unknown title',
        artist: data.author || 'Unknown',
        ext: 'mp3',
        mime: 'audio/mpeg',
      });

      await refreshSongs();

      setMeta({ title: saved.title, author: saved.artist, savedId: saved.id });
      setProgress(1);
      setStatus('Saved for offline use ✅');
      setPhase('done');

      Alert.alert(
        'Saved',
        'Song stored & indexed. You can find it in the Songs tab.',
        [{ text: 'OK', onPress: resetForm }],
        { cancelable: true }
      );
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setPhase('error');
      const msg = e?.message || 'Something went wrong.';
      setStatus(msg);
      Alert.alert('Error', msg);
    } finally {
      cleanupTimers();
    }
  }

  function cancelDownload() {
    controllerRef.current?.abort();
    cleanupTimers();
    setPhase('idle');
    setProgress(0);
    setStatus('Cancelled');
    setMeta(undefined);
  }

  function cleanupTimers() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }

  const isBusy = phase === 'starting' || phase === 'inflight';
  const buttonDisabled = !isValid || isBusy;

  return (
    <View style={styles.screen}>
      <NetworkCheckOvelay>
        <View style={{ flex: 0 }} />
      </NetworkCheckOvelay>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(timing.slow)} style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.h1}>Music Downloader</Text>
              <Text style={styles.badge}>YouTube to MP3</Text>
            </View>
            <Text style={styles.sub}>Paste a YouTube video or Shorts link below.</Text>

            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={url}
                onChangeText={setUrl}
                placeholder="https://youtube.com/watch?v=..."
                placeholderTextColor={tokens.colors.text.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, buttonDisabled ? styles.btnDisabled : styles.btnPrimary]}
                onPress={startDownload}
                disabled={buttonDisabled}
                activeOpacity={pressOpacity.default}>
                {isBusy ? (
                  <View style={styles.btnInnerRow}>
                    <ActivityIndicator
                      size="small"
                      color="#fff"
                      style={{ marginRight: tokens.spacing.sm }}
                    />
                    <Text style={styles.btnText}>Working…</Text>
                  </View>
                ) : (
                  <Text style={styles.btnText}>Get audio</Text>
                )}
              </TouchableOpacity>

              {phase === 'inflight' && (
                <TouchableOpacity
                  style={[styles.btn, styles.btnGhost]}
                  onPress={cancelDownload}
                  activeOpacity={pressOpacity.default}>
                  <Text style={styles.btnGhostText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.progressWrap}>
              <View style={styles.progressLabels}>
                <Text style={styles.statusText}>{status}</Text>
                <Text style={styles.percentText}>{Math.round(progress * 100)}%</Text>
              </View>

              <View style={styles.progressBarBg}>
                <Animated.View style={[styles.progressBarFg, { width: `${progress * 100}%` }]} />
              </View>

              <View style={styles.stepsRow}>
                <StepChip label="Metadata" active={progress >= 0.05} />
                <StepChip label="Preparing" active={progress >= 0.4} />
                <StepChip label="Downloading" active={progress >= 0.5 && progress < 0.99} />
                <StepChip label="Finalizing" active={progress >= 0.99} />
              </View>
            </View>

            {phase === 'done' && (
              <Animated.View entering={FadeIn.duration(timing.normal)} style={styles.resultCard}>
                <Text style={styles.resultTitle}>{meta?.title || 'Unknown title'}</Text>
                <Text style={styles.resultSub}>{meta?.author || 'Unknown author'}</Text>
                {meta?.savedId ? (
                  <Text style={styles.resultNote}>Saved ID: {meta.savedId}</Text>
                ) : null}
              </Animated.View>
            )}

            {phase === 'error' && (
              <Animated.View entering={FadeInDown.duration(timing.normal)} style={styles.errorBox}>
                <Text style={styles.errorText}>{status}</Text>
              </Animated.View>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function StepChip({ label, active }: { label: string; active: boolean }) {
  return (
    <Animated.View
      entering={FadeIn.duration(timing.fast)}
      style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}>
      <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextIdle]}>
        {label}
      </Text>
    </Animated.View>
  );
}

async function parseJsonSafe<T>(resp: Response): Promise<T> {
  const text = await resp.text();
  if (!resp.ok) {
    try {
      const j = JSON.parse(text);
      throw new Error(j?.error || text || `HTTP ${resp.status}`);
    } catch {
      throw new Error(text || `HTTP ${resp.status}`);
    }
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Invalid JSON from server');
  }
}

const styles = StyleSheet.create({
  screen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.colors.bg.primary,
    paddingTop: 60,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.xxl,
  },
  card: {
    backgroundColor: tokens.colors.bg.secondary,
    borderRadius: tokens.radius.xxl,
    padding: tokens.spacing.xl,
    gap: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border.default,
    ...tokens.shadow.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  h1: {
    color: tokens.colors.text.primary,
    fontSize: tokens.fontSize.xxl,
    fontWeight: tokens.fontWeight.semibold,
  },
  badge: {
    color: tokens.colors.text.muted,
    fontSize: tokens.fontSize.xs,
    fontWeight: tokens.fontWeight.medium,
    backgroundColor: tokens.colors.bg.tertiary,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 4,
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    borderColor: tokens.colors.border.default,
    overflow: 'hidden',
  },
  sub: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.fontSize.base,
  },
  inputRow: {
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.bg.input,
    borderWidth: 1,
    borderColor: tokens.colors.border.default,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
  },
  input: {
    color: tokens.colors.text.primary,
    fontSize: tokens.fontSize.md,
  },
  actions: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 130,
  },
  btnPrimary: {
    backgroundColor: tokens.colors.accent.button,
  },
  btnDisabled: {
    backgroundColor: tokens.colors.disabled,
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: tokens.colors.border.focus,
  },
  btnText: {
    color: '#fff',
    fontWeight: tokens.fontWeight.medium,
    fontSize: tokens.fontSize.md,
  },
  btnGhostText: {
    color: tokens.colors.text.tertiary,
    fontWeight: tokens.fontWeight.medium,
    fontSize: tokens.fontSize.md,
  },
  btnInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressWrap: {
    marginTop: tokens.spacing.xs,
    gap: tokens.spacing.sm,
  },
  progressBarBg: {
    height: 10,
    backgroundColor: tokens.colors.bg.tertiary,
    borderRadius: tokens.radius.sm,
    overflow: 'hidden',
  },
  progressBarFg: {
    height: 10,
    backgroundColor: tokens.colors.success,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  statusText: {
    color: tokens.colors.text.tertiary,
    fontSize: tokens.fontSize.base,
  },
  percentText: {
    color: tokens.colors.text.muted,
    fontSize: tokens.fontSize.base,
    fontVariant: ['tabular-nums'],
  },
  stepsRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  chip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 6,
    borderRadius: tokens.radius.full,
  },
  chipActive: {
    backgroundColor: tokens.colors.bg.secondary,
    borderWidth: 1,
    borderColor: tokens.colors.success,
  },
  chipIdle: {
    backgroundColor: tokens.colors.bg.tertiary,
    borderWidth: 1,
    borderColor: tokens.colors.border.default,
  },
  chipText: {
    fontSize: tokens.fontSize.sm,
    fontWeight: tokens.fontWeight.medium,
  },
  chipTextActive: {
    color: '#c7f9cc',
  },
  chipTextIdle: {
    color: tokens.colors.text.tertiary,
  },
  resultCard: {
    marginTop: tokens.spacing.sm,
    backgroundColor: tokens.colors.bg.tertiary,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.default,
    gap: tokens.spacing.xs,
  },
  resultTitle: {
    color: tokens.colors.text.primary,
    fontWeight: tokens.fontWeight.bold,
    fontSize: tokens.fontSize.lg,
  },
  resultSub: {
    color: tokens.colors.text.tertiary,
    fontSize: tokens.fontSize.base,
  },
  resultNote: {
    color: tokens.colors.text.tertiary,
    fontSize: tokens.fontSize.sm,
  },
  errorBox: {
    marginTop: tokens.spacing.sm,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    backgroundColor: '#3b1d1d',
  },
  errorText: {
    color: '#fecaca',
    fontSize: tokens.fontSize.base,
  },
});
