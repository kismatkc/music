import * as React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import NetworkCheckOvelay from '@/components/WifiWarningBanner';
import { tokens, pressOpacity, timing } from '@/lib/tokens';

/* ───── Backend base ───── */
const RAW = (process.env.EXPO_PUBLIC_BACKEND_URL as string) || 'http://localhost:3000';
const BASE = RAW.replace(/\/+$/, '');

async function fetchLyrics(songName: string, linkIndex: number): Promise<string[]> {
  const u = `${BASE}/scraper/scrape-lyrics?songName=${encodeURIComponent(
    songName
  )}&linkIndex=${encodeURIComponent(String(linkIndex))}`;
  const r = await fetch(u);
  if (!r.ok) throw new Error(`Lyrics fetch failed: ${r.status}`);
  const j = (await r.json()) as any;
  return (j?.lyrics ?? []) as string[];
}

export default function LyricsScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = React.useState('');
  const [submitted, setSubmitted] = React.useState<string | null>(null);
  const [sourceIdx, setSourceIdx] = React.useState(0);
  const [lines, setLines] = React.useState<string[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const MAX_SOURCES = 7;

  const runSearch = React.useCallback(async (q: string, idx: number) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const fresh = await fetchLyrics(q.trim(), idx);
      setLines(fresh);
      setSubmitted(q.trim());
    } catch (e: any) {
      setLines(null);
      setError(e?.message || 'Failed to fetch lyrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  const onSubmit = React.useCallback(() => {
    setSourceIdx(0);
    runSearch(query, 0);
  }, [query, runSearch]);

  const onChangeLyrics = React.useCallback(() => {
    if (!submitted) return;
    const next = (sourceIdx + 1) % MAX_SOURCES;
    setSourceIdx(next);
    runSearch(submitted, next);
  }, [submitted, sourceIdx, runSearch]);

  return (
    <>
      <NetworkCheckOvelay>
        <View style={{ flex: 0 }} />
      </NetworkCheckOvelay>

      <View style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.content}>
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>Lyrics</Text>
              <TouchableOpacity
                onPress={onChangeLyrics}
                disabled={!submitted || loading}
                style={[styles.swapBtn, (!submitted || loading) && styles.btnDisabled]}
                activeOpacity={pressOpacity.default}>
                <Text style={styles.swapText}>Change lyrics</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <TextInput
                  placeholder="Search song or artist…"
                  placeholderTextColor={tokens.colors.text.muted}
                  value={query}
                  onChangeText={setQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={onSubmit}
                  style={styles.input}
                />
              </View>
              <TouchableOpacity
                onPress={onSubmit}
                disabled={loading || !query.trim()}
                style={[styles.searchBtn, (loading || !query.trim()) && styles.btnDisabled]}
                activeOpacity={pressOpacity.default}>
                <Text style={styles.searchText}>Search</Text>
              </TouchableOpacity>
            </View>

            {submitted ? (
              <Animated.View entering={FadeIn.duration(timing.fast)} style={styles.metaRow}>
                <Text style={styles.metaLeft} numberOfLines={1}>
                  Results for "{submitted}"
                </Text>
                <Text style={styles.metaRight}>
                  Source {sourceIdx + 1}/{MAX_SOURCES}
                </Text>
              </Animated.View>
            ) : null}

            <View style={styles.resultCard}>
              {loading ? (
                <Animated.View entering={FadeIn.duration(timing.fast)} style={styles.center}>
                  <ActivityIndicator color={tokens.colors.accent.secondary} size="large" />
                  <Text style={styles.loadingText}>Fetching lyrics...</Text>
                </Animated.View>
              ) : error ? (
                <Animated.View entering={FadeInDown.duration(timing.normal)} style={styles.center}>
                  <Text style={styles.errorText}>{error}</Text>
                </Animated.View>
              ) : lines && lines.length ? (
                <FlatList
                  data={lines}
                  keyExtractor={(_, i) => `line-${i}`}
                  contentContainerStyle={styles.lyricsContent}
                  renderItem={({ item, index }) => (
                    <Animated.Text
                      entering={FadeInDown.delay(index * 20).duration(timing.fast)}
                      style={styles.line}>
                      {item || ' '}
                    </Animated.Text>
                  )}
                  showsVerticalScrollIndicator={true}
                  indicatorStyle="white"
                />
              ) : (
                <Animated.View entering={FadeIn.duration(timing.normal)} style={styles.center}>
                  <Text style={styles.placeholderText}>
                    {submitted ? 'No lyrics found.' : 'Search for a song to begin.'}
                  </Text>
                </Animated.View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.colors.bg.primary,
    paddingTop: 60,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.lg,
  },
  headerTitle: {
    color: tokens.colors.text.primary,
    fontSize: tokens.fontSize.xxl,
    fontWeight: tokens.fontWeight.bold,
  },
  searchRow: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  searchBox: {
    flex: 1,
    backgroundColor: tokens.colors.bg.secondary,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border.default,
  },
  input: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    color: tokens.colors.text.primary,
    fontSize: tokens.fontSize.lg,
  },
  searchBtn: {
    paddingHorizontal: tokens.spacing.xl,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.accent.buttonAlt,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 90,
  },
  searchText: {
    color: '#fff',
    fontWeight: tokens.fontWeight.bold,
    fontSize: tokens.fontSize.md,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.xs,
  },
  metaLeft: {
    color: tokens.colors.text.tertiary,
    flex: 1,
    marginRight: tokens.spacing.sm,
    fontSize: tokens.fontSize.base,
  },
  metaRight: {
    color: tokens.colors.text.tertiary,
    fontSize: tokens.fontSize.base,
  },
  resultCard: {
    flex: 1,
    borderRadius: tokens.radius.xxl,
    borderWidth: 1.5,
    borderColor: tokens.colors.border.strong,
    backgroundColor: tokens.colors.bg.tertiary,
    overflow: 'hidden',
    marginBottom: tokens.spacing.sm,
    ...tokens.shadow.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.xxl,
  },
  lyricsContent: {
    padding: tokens.spacing.xl,
    paddingBottom: tokens.spacing.xxxl + tokens.spacing.sm,
  },
  line: {
    color: tokens.colors.text.tertiary,
    fontSize: tokens.fontSize.lg,
    lineHeight: 28,
    marginBottom: 6,
  },
  swapBtn: {
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: 9,
    backgroundColor: tokens.colors.bg.secondary,
    borderWidth: 1,
    borderColor: tokens.colors.border.focus,
  },
  swapText: {
    color: tokens.colors.accent.secondary,
    fontWeight: tokens.fontWeight.bold,
    fontSize: tokens.fontSize.base,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  errorText: {
    color: tokens.colors.error,
    fontSize: tokens.fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingText: {
    color: tokens.colors.accent.secondary,
    marginTop: tokens.spacing.md,
    fontSize: tokens.fontSize.base,
  },
  placeholderText: {
    color: tokens.colors.text.muted,
    fontSize: tokens.fontSize.md,
    textAlign: 'center',
  },
});
