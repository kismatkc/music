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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import {
  playSongById,
  removeSong,
  updateSongMeta,
  useMusic,
} from '@/lib/music-player-all-controls';
import { tokens, pressOpacity, timing } from '@/lib/tokens';
import { triggerHaptic } from '@/lib/haptics';
import { isFeatureEnabled } from '@/lib/featureFlags';
import { SongsSkeleton } from '@/components/SkeletonLoader';

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
  if (sec == null || sec === 0) return '0:00';
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
};

export default function SongsScreen() {
  const insets = useSafeAreaInsets();
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
    triggerHaptic('light');
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
      await triggerHaptic('success');
      setEditOpen(false);
    } catch (e: any) {
      await triggerHaptic('error');
      Alert.alert('Error', e?.message || 'Failed to update song.');
    } finally {
      setSaving(false);
    }
  }

  function onDelete(row: Row) {
    triggerHaptic('warning');
    Alert.alert('Delete song?', `"${row.title}" will be removed from your device.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeSong(row.id);
            await triggerHaptic('success');
          } catch (e: any) {
            await triggerHaptic('error');
            Alert.alert('Error', e?.message || 'Failed to delete song.');
          }
        },
      },
    ]);
  }

  // FlatList optimization - calculate item layout for better performance
  const getItemLayout = React.useCallback(
    (_: any, index: number) => ({
      length: 68 + tokens.spacing.sm, // row height + separator
      offset: (68 + tokens.spacing.sm) * index,
      index,
    }),
    []
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.searchWrap}>
        <TextInput
          placeholder="Search songs, artists, albums…"
          placeholderTextColor={tokens.colors.text.muted}
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {!rows.length && !isRefreshing ? (
        <Animated.View entering={FadeIn.duration(timing.normal)} style={styles.emptyWrap}>
          <Image source={defaultArtwork} style={styles.emptyArt} />
          <Text style={styles.emptyTitle}>No songs yet</Text>
          <Text style={styles.emptySub}>Use the Download tab to save music.</Text>
        </Animated.View>
      ) : isRefreshing && rows.length === 0 && isFeatureEnabled('ENABLE_SKELETON_LOADER') ? (
        <SongsSkeleton />
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
              tintColor={tokens.colors.text.tertiary}
              titleColor={tokens.colors.text.tertiary}
            />
          }
          renderItem={({ item, index }) => (
            <SongRow
              row={item}
              index={index}
              onEdit={() => openEdit(item)}
              onDelete={() => onDelete(item)}
              onPlay={() => playSongById(item.id)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={{ paddingBottom: tokens.spacing.xxl }}
          // Performance optimizations (feature-flagged)
          getItemLayout={isFeatureEnabled('ENABLE_LIST_OPTIMIZATION') ? getItemLayout : undefined}
          windowSize={isFeatureEnabled('ENABLE_LIST_OPTIMIZATION') ? 10 : 21}
          maxToRenderPerBatch={isFeatureEnabled('ENABLE_LIST_OPTIMIZATION') ? 10 : 10}
          updateCellsBatchingPeriod={isFeatureEnabled('ENABLE_LIST_OPTIMIZATION') ? 50 : 50}
          removeClippedSubviews={isFeatureEnabled('ENABLE_LIST_OPTIMIZATION')}
        />
      )}

      {/* Edit Modal */}
      <Modal
        visible={editOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeInDown.duration(timing.normal)} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit song</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Title"
                placeholderTextColor={tokens.colors.text.secondary}
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
                placeholderTextColor={tokens.colors.text.secondary}
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
                placeholderTextColor={tokens.colors.text.secondary}
                style={styles.input}
                autoCorrect={false}
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setEditOpen(false)}
                style={[styles.btn, styles.btnGhost]}
                disabled={saving}
                activeOpacity={pressOpacity.default}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onSaveEdit}
                style={[styles.btn, saving ? styles.btnDisabled : styles.btnPrimary]}
                disabled={saving}
                activeOpacity={pressOpacity.default}>
                <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

function SongRow({
  row,
  index,
  onEdit,
  onDelete,
  onPlay,
}: {
  row: Row;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onPlay: () => void;
}) {
  const artSource = row.artwork ? { uri: row.artwork } : defaultArtwork;

  const handlePlay = React.useCallback(async () => {
    await triggerHaptic('light');
    onPlay();
  }, [onPlay]);

  const openMenu = () => {
    triggerHaptic('light');
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
    <Animated.View entering={FadeInDown.delay(index * 30).duration(timing.normal)}>
      <TouchableOpacity activeOpacity={pressOpacity.light} onPress={handlePlay} style={styles.row}>
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
            activeOpacity={pressOpacity.default}
            accessibilityLabel="More actions">
            <MoreHorizontal size={18} color={tokens.colors.text.tertiary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* Reanimated marquee */
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
        style={[
          style,
          shouldAnimate ? { width: 9999, paddingLeft: tokens.spacing.lg } : null,
          anim,
        ]}>
        {text}
      </Animated.Text>
    </View>
  );
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
    paddingHorizontal: tokens.spacing.lg,
  },
  searchWrap: {
    backgroundColor: tokens.colors.bg.secondary,
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.default,
    marginBottom: tokens.spacing.lg,
  },
  searchInput: {
    color: tokens.colors.text.primary,
    fontSize: tokens.fontSize.md,
  },
  sep: { height: tokens.spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.bg.secondary,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
  },
  art: {
    width: 52,
    height: 52,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.bg.tertiary,
  },
  meta: {
    flex: 1,
    marginLeft: tokens.spacing.md,
    minWidth: 0,
  },
  titleClip: { overflow: 'hidden' },
  title: {
    color: tokens.colors.text.primary,
    fontWeight: tokens.fontWeight.bold,
    fontSize: tokens.fontSize.md,
  },
  sub: {
    color: tokens.colors.text.secondary,
    marginTop: 2,
    fontSize: tokens.fontSize.base,
  },
  rightCol: {
    marginLeft: tokens.spacing.sm,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 44,
  },
  duration: {
    color: tokens.colors.text.muted,
    fontVariant: ['tabular-nums'],
    fontSize: tokens.fontSize.sm,
  },
  moreBtn: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.bg.tertiary,
    borderWidth: 1,
    borderColor: tokens.colors.border.strong,
  },

  // modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: tokens.colors.overlay,
    justifyContent: 'center',
    padding: tokens.spacing.lg,
  },
  modalCard: {
    backgroundColor: tokens.colors.bg.secondary,
    borderRadius: tokens.radius.xxl,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.default,
    ...tokens.shadow.lg,
  },
  modalTitle: {
    color: tokens.colors.text.primary,
    fontSize: tokens.fontSize.xl,
    fontWeight: tokens.fontWeight.bold,
  },
  field: { gap: 6 },
  label: {
    color: tokens.colors.text.tertiary,
    fontSize: tokens.fontSize.sm,
  },
  input: {
    color: tokens.colors.text.primary,
    backgroundColor: tokens.colors.bg.input,
    borderWidth: 1,
    borderColor: tokens.colors.border.default,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    fontSize: tokens.fontSize.md,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.xs,
  },
  btn: {
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  btnPrimary: { backgroundColor: tokens.colors.accent.button },
  btnDisabled: { backgroundColor: tokens.colors.disabled },
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
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  emptyArt: {
    width: 80,
    height: 80,
    borderRadius: tokens.radius.xxl,
    opacity: 0.6,
  },
  emptyTitle: {
    color: tokens.colors.text.primary,
    fontWeight: tokens.fontWeight.bold,
    fontSize: tokens.fontSize.lg,
  },
  emptySub: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.fontSize.base,
  },
});
