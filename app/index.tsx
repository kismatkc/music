import * as React from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActionSheetIOS,
  StyleProp,
  TextStyle,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { MoreHorizontal } from 'lucide-react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  playSongById,
  removeSong,
  updateSongMeta,
  useMusic,
} from '@/lib/music-player-all-controls';

type Row = {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  artwork?: string;
  duration?: number;
};
const defaultArtwork = require('../assets/unknown_artist.png');

const formatDuration = (sec?: number) => {
  if (sec == null) return '—:—';
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
};

export default function SongsScreen() {
  const songs = useMusic((s) => s.songs);
  const refresh = useMusic((s) => s.refresh);

  const [query, setQuery] = React.useState('');
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Edit modal
  const [editOpen, setEditOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState('');
  const [editArtist, setEditArtist] = React.useState('');
  const [editAlbum, setEditAlbum] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      (async () => {
        setIsRefreshing(true);
        try {
          await refresh();
        } finally {
          if (mounted) setIsRefreshing(false);
        }
      })();
      return () => {
        mounted = false;
      };
    }, [refresh])
  );

  const rows = React.useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    return songs
      .map((s) => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        album: s.album,
        artwork: s.artwork,
        duration: s.duration ?? s.variants?.full?.duration,
      }))
      .filter((r) =>
        q
          ? (r.title || '').toLowerCase().includes(q) ||
            (r.artist || '').toLowerCase().includes(q) ||
            (r.album || '').toLowerCase().includes(q)
          : true
      );
  }, [songs, query]);

  function openEdit(row: Row) {
    setEditId(row.id);
    setEditTitle(row.title ?? '');
    setEditArtist(row.artist ?? '');
    setEditAlbum(row.album ?? '');
    setEditOpen(true);
  }

  async function onSaveEdit() {
    if (!editId) return;
    const title = editTitle.trim();
    if (!title) {
      Alert.alert('Title required', 'Please enter a title.');
      return;
    }
    setSaving(true);
    try {
      await updateSongMeta({
        id: editId,
        title,
        artist: editArtist.trim() || undefined,
        album: editAlbum.trim() || undefined,
      });
      setEditOpen(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update song.');
    } finally {
      setSaving(false);
    }
  }
  function onDelete(row: Row) {
    Alert.alert('Delete song?', `"${row.title}" will be removed from your device.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeSong(row.id);
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to delete song.');
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.searchWrap}>
        <TextInput
          placeholder="Search songs, artists, albums…"
          placeholderTextColor="#9aa0a6"
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {!rows.length && !isRefreshing ? (
        <View style={styles.emptyWrap}>
          <Image source={defaultArtwork} style={styles.emptyArt} />
          <Text style={styles.emptyTitle}>No songs yet</Text>
          <Text style={styles.emptySub}>Use the Download tab to save music.</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={async () => {
                setIsRefreshing(true);
                try {
                  await refresh();
                } finally {
                  setIsRefreshing(false);
                }
              }}
              tintColor="#cbd5e1"
              titleColor="#cbd5e1"
            />
          }
          renderItem={({ item }) => (
            <SongRow
              row={item}
              onEdit={() => openEdit(item)}
              onDelete={() => onDelete(item)}
              onPlay={() => playSongById(item.id)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={{ paddingBottom: 24, paddingTop: 4 }}
        />
      )}

      {/* Edit Modal (unchanged) */}
      <Modal
        visible={editOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit song</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Title"
                placeholderTextColor="#9aa0a6"
                style={styles.input}
                autoCorrect={false}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Artist</Text>
              <TextInput
                value={editArtist}
                onChangeText={setEditArtist}
                placeholder="Artist"
                placeholderTextColor="#9aa0a6"
                style={styles.input}
                autoCorrect={false}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Album</Text>
              <TextInput
                value={editAlbum}
                onChangeText={setEditAlbum}
                placeholder="Album"
                placeholderTextColor="#9aa0a6"
                style={styles.input}
                autoCorrect={false}
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setEditOpen(false)}
                style={[styles.btn, styles.btnGhost]}
                disabled={saving}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onSaveEdit}
                style={[styles.btn, saving ? styles.btnDisabled : styles.btnPrimary]}
                disabled={saving}>
                <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SongRow({
  row,
  onEdit,
  onDelete,
  onPlay,
}: {
  row: Row;
  onEdit: () => void;
  onDelete: () => void;
  onPlay: () => void;
}) {
  const artSource = row.artwork ? { uri: row.artwork } : defaultArtwork;

  const openMenu = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Edit', 'Delete'],
        cancelButtonIndex: 0,
        destructiveButtonIndex: 2,
        userInterfaceStyle: 'dark',
      },
      (i) => {
        if (i === 1) onEdit();
        else if (i === 2) onDelete();
      }
    );
  };

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPlay} style={styles.row}>
      <Image source={artSource} style={styles.art} />
      <View style={styles.meta}>
        <Marquee text={row.title} style={styles.title} />
        <Text numberOfLines={1} style={styles.sub}>
          {row.artist || 'Unknown artist'}
        </Text>
      </View>
      <View style={styles.rightCol}>
        <Text style={styles.duration}>{formatDuration(row.duration)}</Text>
        <TouchableOpacity
          style={styles.moreBtn}
          onPress={openMenu}
          accessibilityLabel="More actions">
          <MoreHorizontal size={18} color="#cbd5e1" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

/* Reanimated marquee (string-length based – no layout flakiness in lists) */
function Marquee({
  text,
  style,
  speedPxPerSec = 28,
  threshold = 22,
  pxPerChar = 8,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  speedPxPerSec?: number;
  threshold?: number;
  pxPerChar?: number;
}) {
  const translateX = useSharedValue(0);
  const shouldAnimate = text.length >= threshold;
  const travel = Math.max(200, Math.floor(text.length * pxPerChar));
  React.useEffect(() => {
    if (!shouldAnimate) {
      cancelAnimation(translateX);
      translateX.value = 0;
      return;
    }
    const duration = Math.round((travel / speedPxPerSec) * 1000);
    translateX.value = withDelay(
      700,
      withRepeat(withTiming(-travel, { duration, easing: Easing.linear }), -1, true)
    );
    return () => {
      cancelAnimation(translateX);
      translateX.value = 0;
    };
  }, [shouldAnimate, travel, speedPxPerSec, translateX]);
  const anim = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  return (
    <View style={styles.titleClip}>
      <Animated.Text
        numberOfLines={1}
        style={[style, shouldAnimate ? { width: 9999, paddingLeft: 16 } : null, anim]}>
        {text}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f1115',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  // add a little more top margin so a native back arrow never overlaps the search field
  searchWrap: {
    backgroundColor: '#171a21',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#2a2f3a',
    marginBottom: 12,
    marginTop: 16, // was 8/12 — bumped to 16
  },
  searchInput: { color: '#e8eaed', fontSize: 15 },
  sep: { height: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171a21',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1f2530',
  },
  art: { width: 52, height: 52, borderRadius: 8, backgroundColor: '#11151c' },
  meta: { flex: 1, marginLeft: 12, minWidth: 0 },
  titleClip: { overflow: 'hidden' },
  title: { color: '#e5e7eb', fontWeight: '700', fontSize: 15 },
  sub: { color: '#9aa0a6', marginTop: 2 },
  rightCol: {
    marginLeft: 8,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 44,
  },
  duration: { color: '#94a3b8', fontVariant: ['tabular-nums'], fontSize: 12 },
  moreBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#10141c',
    borderWidth: 1,
    borderColor: '#273144',
  },

  // modal styles unchanged...
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#171a21',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#2a2f3a',
  },
  modalTitle: { color: '#e5e7eb', fontSize: 18, fontWeight: '700' },
  field: { gap: 6 },
  label: { color: '#aab2c0', fontSize: 12 },
  input: {
    color: '#e8eaed',
    backgroundColor: '#0f1115',
    borderWidth: 1,
    borderColor: '#2a2f3a',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  btn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  btnPrimary: { backgroundColor: '#4f46e5' },
  btnDisabled: { backgroundColor: '#2a2f3a' },
  btnGhost: { borderWidth: 1, borderColor: '#39414f' },
  btnText: { color: '#fff', fontWeight: '600' },
  btnGhostText: { color: '#aab2c0', fontWeight: '600' },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyArt: { width: 80, height: 80, borderRadius: 16, opacity: 0.6 },
  emptyTitle: { color: '#e5e7eb', fontWeight: '700', fontSize: 16 },
  emptySub: { color: '#9aa0a6' },
});
