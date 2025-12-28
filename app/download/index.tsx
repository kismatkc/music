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
import { SafeAreaView } from 'react-native-safe-area-context';
import { ensureInit, saveBase64AsSong, useMusic } from '@/lib/music-player-all-controls';
import NetworkCheckOvelay from '@/components/WifiWarningBanner';

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
  const pollRef = React.useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

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
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <NetworkCheckOvelay isConnected={isInternetReachable ?? true} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.h1}>Offline Music – Downloader</Text>
            <Text style={styles.sub}>Paste a YouTube video or Shorts link.</Text>

            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={url}
                onChangeText={setUrl}
                placeholder="https://youtube.com/watch?v=..."
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, buttonDisabled ? styles.btnDisabled : styles.btnPrimary]}
                onPress={startDownload}
                disabled={buttonDisabled}>
                {isBusy ? (
                  <View style={styles.btnInnerRow}>
                    <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.btnText}>Working…</Text>
                  </View>
                ) : (
                  <Text style={styles.btnText}>Get audio</Text>
                )}
              </TouchableOpacity>

              {phase === 'inflight' && (
                <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={cancelDownload}>
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
                <View style={[styles.progressBarFg, { width: `${progress * 100}%` }]} />
              </View>

              <View style={styles.stepsRow}>
                <StepChip label="Metadata" active={progress >= 0.05} />
                <StepChip label="Preparing" active={progress >= 0.4} />
                <StepChip label="Downloading" active={progress >= 0.5 && progress < 0.99} />
                <StepChip label="Finalizing" active={progress >= 0.99} />
              </View>
            </View>

            {phase === 'done' && (
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>{meta?.title || 'Unknown title'}</Text>
                <Text style={styles.resultSub}>{meta?.author || 'Unknown author'}</Text>
                {meta?.savedId ? (
                  <Text style={styles.resultNote}>Saved ID: {meta.savedId}</Text>
                ) : null}
              </View>
            )}

            {phase === 'error' && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{status}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StepChip({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}>
      <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextIdle]}>
        {label}
      </Text>
    </View>
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
    flex: 1,
    backgroundColor: '#0f1115',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  card: {
    backgroundColor: '#171a21',
    borderRadius: 16,
    padding: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  h1: {
    color: '#e8eaed',
    fontSize: 22,
    fontWeight: '700',
  },
  sub: {
    color: '#9aa0a6',
    fontSize: 14,
  },
  inputRow: {
    borderRadius: 12,
    backgroundColor: '#0f1115',
    borderWidth: 1,
    borderColor: '#2a2f3a',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  input: {
    color: '#e8eaed',
    fontSize: 15,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 130,
  },
  btnPrimary: {
    backgroundColor: '#4f46e5',
  },
  btnDisabled: {
    backgroundColor: '#2a2f3a',
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: '#39414f',
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  btnGhostText: {
    color: '#aab2c0',
    fontWeight: '600',
    fontSize: 15,
  },
  btnInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressWrap: {
    marginTop: 4,
    gap: 8,
  },
  progressBarBg: {
    height: 10,
    backgroundColor: '#1e2430',
    borderRadius: 8,
    overflow: 'hidden',
  },
  progressBarFg: {
    height: 10,
    backgroundColor: '#22c55e',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  statusText: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  percentText: {
    color: '#94a3b8',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  stepsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipActive: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#22c55e55',
  },
  chipIdle: {
    backgroundColor: '#141922',
    borderWidth: 1,
    borderColor: '#293041',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#c7f9cc',
  },
  chipTextIdle: {
    color: '#8d99ae',
  },
  resultCard: {
    marginTop: 8,
    backgroundColor: '#0f141c',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2f3a',
    gap: 4,
  },
  resultTitle: {
    color: '#e5e7eb',
    fontWeight: '700',
    fontSize: 16,
  },
  resultSub: {
    color: '#a6b0c0',
    fontSize: 14,
  },
  resultNote: {
    color: '#8d99ae',
    fontSize: 12,
  },
  errorBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#3b1d1d',
  },
  errorText: {
    color: '#fecaca',
    fontSize: 14,
  },
});
