// import * as React from 'react';
// import {
//   View,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   FlatList,
//   ActivityIndicator,
//   StyleSheet,
// } from 'react-native';
// import { useHeaderHeight } from '@react-navigation/elements';
// import NetworkCheckOvelay from '@/components/WifiWarningBanner';

// /* ───── Backend base ───── */
// const RAW = (process.env.EXPO_PUBLIC_BACKEND_URL as string) || 'http://localhost:3000';
// const BASE = RAW.replace(/\/+$/, '');

// async function fetchLyrics(songName: string, linkIndex: number): Promise<string[]> {
//   const u = `${BASE}/scraper/scrape-lyrics?songName=${encodeURIComponent(
//     songName
//   )}&linkIndex=${encodeURIComponent(String(linkIndex))}`;
//   const r = await fetch(u);
//   if (!r.ok) throw new Error(`Lyrics fetch failed: ${r.status}`);
//   const j = (await r.json()) as any;
//   return (j?.lyrics ?? []) as string[];
// }

// export default function LyricsScreen() {
//   const headerH = useHeaderHeight(); // ← pushes content below back button/header

//   const [query, setQuery] = React.useState('');
//   const [submitted, setSubmitted] = React.useState<string | null>(null);
//   const [sourceIdx, setSourceIdx] = React.useState(0); // 0..6
//   const [lines, setLines] = React.useState<string[] | null>(null);
//   const [loading, setLoading] = React.useState(false);
//   const [error, setError] = React.useState<string | null>(null);

//   const MAX_SOURCES = 7;

//   const runSearch = React.useCallback(async (q: string, idx: number) => {
//     if (!q.trim()) return;
//     setLoading(true);
//     setError(null);
//     try {
//       const fresh = await fetchLyrics(q.trim(), idx);
//       setLines(fresh);
//       setSubmitted(q.trim());
//     } catch (e: any) {
//       setLines(null);
//       setError(e?.message || 'Failed to fetch lyrics.');
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   const onSubmit = React.useCallback(() => {
//     setSourceIdx(0);
//     runSearch(query, 0);
//   }, [query, runSearch]);

//   const onChangeLyrics = React.useCallback(() => {
//     if (!submitted) return;
//     const next = (sourceIdx + 1) % MAX_SOURCES;
//     setSourceIdx(next);
//     runSearch(submitted, next);
//   }, [submitted, sourceIdx, runSearch]);

//   return (
//     <View style={[styles.container, { paddingTop: headerH + 8 }]}>
//       <NetworkCheckOvelay>
//         <View style={styles.headerRow}>
//           <Text style={styles.headerTitle}>Lyrics</Text>
//           <TouchableOpacity
//             onPress={onChangeLyrics}
//             disabled={!submitted || loading}
//             style={[styles.swapBtn, (!submitted || loading) && { opacity: 0.6 }]}>
//             <Text style={styles.swapText}>Change lyrics</Text>
//           </TouchableOpacity>
//         </View>

//         <View style={styles.searchRow}>
//           <View style={styles.searchBox}>
//             <TextInput
//               placeholder="Search song or artist…"
//               placeholderTextColor="#8b95a7"
//               value={query}
//               onChangeText={setQuery}
//               autoCapitalize="none"
//               autoCorrect={false}
//               returnKeyType="search"
//               onSubmitEditing={onSubmit}
//               style={styles.input}
//             />
//           </View>
//           <TouchableOpacity
//             onPress={onSubmit}
//             disabled={loading || !query.trim()}
//             style={[styles.searchBtn, (loading || !query.trim()) && { opacity: 0.6 }]}>
//             <Text style={styles.searchText}>Search</Text>
//           </TouchableOpacity>
//         </View>

//         {submitted ? (
//           <View style={styles.metaRow}>
//             <Text style={styles.metaLeft} numberOfLines={1}>
//               Results for "{submitted}"
//             </Text>
//             <Text style={styles.metaRight}>
//               Source {sourceIdx + 1}/{MAX_SOURCES}
//             </Text>
//           </View>
//         ) : null}

//         <View style={styles.resultCard}>
//           {loading ? (
//             <View style={styles.center}>
//               <ActivityIndicator color="#93c5fd" />
//             </View>
//           ) : error ? (
//             <View style={styles.center}>
//               <Text style={styles.errorText}>{error}</Text>
//             </View>
//           ) : lines && lines.length ? (
//             <FlatList
//               style={{ flex: 1 }}
//               data={lines}
//               keyExtractor={(_, i) => `line-${i}`}
//               contentContainerStyle={{ padding: 12 }}
//               renderItem={({ item }) => <Text style={styles.line}>{item || ' '}</Text>}
//             />
//           ) : (
//             <View style={styles.center}>
//               <Text style={{ color: '#94a3b8' }}>
//                 {submitted ? 'No lyrics found.' : 'Search for a song to begin.'}
//               </Text>
//             </View>
//           )}
//         </View>
//       </NetworkCheckOvelay>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#0f1115',
//     paddingHorizontal: 14,
//   },
//   headerRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginVertical: 25,
//   },
//   headerTitle: { color: '#e5e7eb', fontSize: 22, fontWeight: '800' },

//   searchRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
//   searchBox: {
//     flex: 1,
//     backgroundColor: '#171a21',
//     borderRadius: 12,
//     borderWidth: 1,
//     borderColor: '#2a2f3a',
//   },
//   input: {
//     paddingHorizontal: 12,
//     paddingVertical: 10,
//     color: '#e8eaed',
//     fontSize: 16,
//   },
//   searchBtn: {
//     paddingHorizontal: 14,
//     borderRadius: 10,
//     backgroundColor: '#111827',
//     borderWidth: 1,
//     borderColor: '#334155',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   searchText: { color: '#93c5fd', fontWeight: '700' },

//   metaRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginBottom: 8,
//     paddingHorizontal: 2,
//   },
//   metaLeft: { color: '#8ea0b5', flex: 1, marginRight: 6 },
//   metaRight: { color: '#8ea0b5' },

//   resultCard: {
//     flex: 1,
//     borderRadius: 14,
//     borderWidth: 1,
//     borderColor: '#273144',
//     backgroundColor: '#0f141c',
//     overflow: 'hidden',
//   },
//   center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
//   line: { color: '#cbd5e1', fontSize: 16, lineHeight: 24, marginBottom: 2 },

//   swapBtn: {
//     borderRadius: 10,
//     paddingHorizontal: 10,
//     paddingVertical: 8,
//     backgroundColor: '#111827',
//     borderWidth: 1,
//     borderColor: '#334155',
//   },
//   swapText: { color: '#93c5fd', fontWeight: '700' },

//   errorText: { color: '#ef4444' },
// });

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
import { SafeAreaView } from 'react-native-safe-area-context';
import NetworkCheckOvelay from '@/components/WifiWarningBanner';

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

      <SafeAreaView style={styles.container} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.content}>
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>Lyrics</Text>
              <TouchableOpacity
                onPress={onChangeLyrics}
                disabled={!submitted || loading}
                style={[styles.swapBtn, (!submitted || loading) && styles.btnDisabled]}>
                <Text style={styles.swapText}>Change lyrics</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <TextInput
                  placeholder="Search song or artist…"
                  placeholderTextColor="#8b95a7"
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
                style={[styles.searchBtn, (loading || !query.trim()) && styles.btnDisabled]}>
                <Text style={styles.searchText}>Search</Text>
              </TouchableOpacity>
            </View>

            {submitted ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLeft} numberOfLines={1}>
                  Results for "{submitted}"
                </Text>
                <Text style={styles.metaRight}>
                  Source {sourceIdx + 1}/{MAX_SOURCES}
                </Text>
              </View>
            ) : null}

            <View style={styles.resultCard}>
              {loading ? (
                <View style={styles.center}>
                  <ActivityIndicator color="#93c5fd" size="large" />
                  <Text style={styles.loadingText}>Fetching lyrics...</Text>
                </View>
              ) : error ? (
                <View style={styles.center}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : lines && lines.length ? (
                <FlatList
                  data={lines}
                  keyExtractor={(_, i) => `line-${i}`}
                  contentContainerStyle={styles.lyricsContent}
                  renderItem={({ item }) => <Text style={styles.line}>{item || ' '}</Text>}
                  showsVerticalScrollIndicator={true}
                  indicatorStyle="white"
                />
              ) : (
                <View style={styles.center}>
                  <Text style={styles.placeholderText}>
                    {submitted ? 'No lyrics found.' : 'Search for a song to begin.'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1115',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    color: '#e5e7eb',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  searchBox: {
    flex: 1,
    backgroundColor: '#171a21',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2f3a',
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#e8eaed',
    fontSize: 16,
  },
  searchBtn: {
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#1e40af',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 90,
  },
  searchText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  metaLeft: {
    color: '#8ea0b5',
    flex: 1,
    marginRight: 8,
    fontSize: 13,
  },
  metaRight: {
    color: '#8ea0b5',
    fontSize: 13,
  },
  resultCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#273144',
    backgroundColor: '#0f141c',
    overflow: 'hidden',
    marginBottom: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  lyricsContent: {
    padding: 20,
    paddingBottom: 40,
  },
  line: {
    color: '#cbd5e1',
    fontSize: 16,
    lineHeight: 28,
    marginBottom: 6,
  },
  swapBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  swapText: {
    color: '#93c5fd',
    fontWeight: '700',
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingText: {
    color: '#93c5fd',
    marginTop: 12,
    fontSize: 14,
  },
  placeholderText: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'center',
  },
});
