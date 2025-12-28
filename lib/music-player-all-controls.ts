// lib/music-player-all-controls.ts

import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import * as SQLite from 'expo-sqlite';
import { Audio } from 'expo-av';
import { create } from 'zustand';

/* ───────── Types ───────── */

export type Variant = 'full' | 'vocals' | 'instrumental';

export interface AudioFile {
  uri: string;
  mime: string;
  size: number;
  duration?: number;
}
export interface Song {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  artwork?: string;
  duration?: number;
  variants: { full: AudioFile; vocals?: AudioFile; instrumental?: AudioFile };
  lyrics?: string[];
  createdAt: number;
  playCount?: number;
  favorite?: boolean;
}

/* ───────── Paths / DB ───────── */

const APP_SUPPORT =
  Platform.OS === 'ios'
    ? `${RNFS.LibraryDirectoryPath}/Application Support/OfflinePlayer`
    : `${RNFS.DocumentDirectoryPath}/OfflinePlayer`;

export const PATHS = {
  app: APP_SUPPORT,
  dbName: 'offline-player.db',
  songs: `${APP_SUPPORT}/songs`,
  songDir: (id: string) => `${APP_SUPPORT}/songs/${id}`,
  variant: (id: string, v: Variant, ext = 'mp3') => `${APP_SUPPORT}/songs/${id}/${v}.${ext}`,
  artwork: (id: string) => `${APP_SUPPORT}/songs/${id}/artwork.jpg`,
  lyrics: (id: string) => `${APP_SUPPORT}/songs/${id}/lyrics.txt`,
};

const db = SQLite.openDatabaseSync(PATHS.dbName);
const run = (sql: string, params: SQLite.SQLiteBindParams = []) => db.runSync(sql, params);
const all = <T = any>(sql: string, params: SQLite.SQLiteBindParams = []) =>
  db.getAllSync(sql, params) as unknown as T[];

function migrate() {
  run(`
    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      artist TEXT,
      album TEXT,
      artwork TEXT,
      duration REAL,
      createdAt INTEGER NOT NULL,
      playCount INTEGER DEFAULT 0,
      favorite INTEGER DEFAULT 0,
      json TEXT NOT NULL
    );
  `);
}

async function ensureFolders() {
  for (const p of [PATHS.app, PATHS.songs]) {
    if (!(await RNFS.exists(p))) await RNFS.mkdir(p);
  }
}
export async function ensureInit() {
  await ensureFolders();
  migrate();
}

const uuid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const base64ToApproxBytes = (b64: string) => {
  const len = b64.length;
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((len * 3) / 4) - pad);
};

// Detect actual file format from base64 data
function detectAudioFormat(base64: string): { ext: string; mime: string } {
  // Clean base64 and get first few characters to check magic bytes
  let cleanBase64 = base64.trim();
  if (cleanBase64.startsWith('data:')) {
    const commaIndex = cleanBase64.indexOf(',');
    if (commaIndex !== -1) {
      cleanBase64 = cleanBase64.substring(commaIndex + 1);
    }
  }

  // Decode first 16 bytes to check magic numbers
  try {
    const firstBytes = atob(cleanBase64.substring(0, 24)); // Decode first ~16 bytes
    const bytes = Array.from(firstBytes).map((c) => c.charCodeAt(0));

    console.log('First 16 bytes:', bytes.map((b) => b.toString(16).padStart(2, '0')).join(' '));

    // Check for MP3 (ID3 tag or frame sync)
    if (
      (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || // ID3v2
      (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
    ) {
      // MP3 frame sync
      return { ext: 'mp3', mime: 'audio/mpeg' };
    }

    // Check for M4A/AAC (ftyp box)
    if (firstBytes.includes('ftyp') || firstBytes.includes('M4A')) {
      return { ext: 'm4a', mime: 'audio/mp4' };
    }

    // Check for WAV (RIFF header)
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      return { ext: 'wav', mime: 'audio/wav' };
    }

    // Check for MP4 video (might be audio track)
    if (firstBytes.includes('ftyp') || firstBytes.includes('mp4')) {
      return { ext: 'm4a', mime: 'audio/mp4' };
    }

    console.warn('Unknown audio format, defaulting to mp3');
    return { ext: 'mp3', mime: 'audio/mpeg' };
  } catch (error) {
    console.error('Error detecting format:', error);
    return { ext: 'mp3', mime: 'audio/mpeg' };
  }
}

/* ───────── CRUD ───────── */

export async function saveBase64AsSong(args: {
  base64: string;
  title: string;
  artist?: string;
  album?: string;
  artworkBase64?: string;
  lyrics?: string[];
  ext?: 'mp3' | 'm4a';
  mime?: 'audio/mpeg' | 'audio/mp4';
}): Promise<Song> {
  await ensureInit();
  const id = uuid();
  const createdAt = Date.now();

  // Auto-detect format if not specified
  const detected = detectAudioFormat(args.base64);
  const ext = args.ext ?? (detected.ext as 'mp3' | 'm4a');
  const mime = args.mime ?? (detected.mime as 'audio/mpeg' | 'audio/mp4');

  console.log('Detected format:', { ext, mime });

  const dir = PATHS.songDir(id);
  if (!(await RNFS.exists(dir))) await RNFS.mkdir(dir);

  const fullPath = PATHS.variant(id, 'full', ext);

  // Log what we're getting
  console.log('Saving audio file:', {
    title: args.title,
    ext: ext,
    mime: mime,
    base64Length: args.base64.length,
    base64Preview: args.base64.substring(0, 100) + '...',
  });

  // Simple, direct base64 to file conversion - no validation
  let cleanBase64 = args.base64.trim();

  // Remove data URL prefix if present
  if (cleanBase64.startsWith('data:')) {
    console.log('Removing data URL prefix');
    const commaIndex = cleanBase64.indexOf(',');
    if (commaIndex !== -1) {
      cleanBase64 = cleanBase64.substring(commaIndex + 1);
    }
  }

  await RNFS.writeFile(fullPath, cleanBase64, 'base64');
  console.log('File written to:', fullPath);

  // Check file size after writing
  const stat = await RNFS.stat(fullPath);
  console.log('File size:', stat.size, 'bytes');

  const fullUri = `file://${fullPath}`;
  const size = base64ToApproxBytes(args.base64);

  let artworkUri: string | undefined;
  if (args.artworkBase64) {
    const aPath = PATHS.artwork(id);
    await RNFS.writeFile(aPath, args.artworkBase64, 'base64');
    artworkUri = `file://${aPath}`;
  }
  if (args.lyrics?.length) {
    const lPath = PATHS.lyrics(id);
    await RNFS.writeFile(lPath, args.lyrics.join('\n'), 'utf8');
  }

  const song: Song = {
    id,
    title: args.title,
    artist: args.artist,
    album: args.album,
    artwork: artworkUri,
    duration: undefined, // Don't try to detect duration, let the player handle it
    variants: { full: { uri: fullUri, mime, size } },
    lyrics: args.lyrics,
    createdAt,
    playCount: 0,
    favorite: false,
  };

  run(
    `INSERT OR REPLACE INTO songs
     (id,title,artist,album,artwork,duration,createdAt,playCount,favorite,json)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      song.id,
      song.title,
      song.artist ?? null,
      song.album ?? null,
      song.artwork ?? null,
      song.duration ?? null,
      song.createdAt,
      song.playCount ?? 0,
      song.favorite ? 1 : 0,
      JSON.stringify(song),
    ]
  );
  useMusic.getState().add(song);
  return song;
}

export async function fetchSongs(): Promise<Song[]> {
  const rows = all<{ json: string }>(`SELECT json FROM songs ORDER BY createdAt DESC`);
  return rows.map((r) => JSON.parse(r.json) as Song);
}
export async function fetchSong(id: string): Promise<Song | null> {
  const rows = all<{ json: string }>(`SELECT json FROM songs WHERE id=?`, [id]);
  return rows[0] ? (JSON.parse(rows[0].json) as Song) : null;
}
export async function removeSong(id: string) {
  const dir = PATHS.songDir(id);
  if (await RNFS.exists(dir)) await RNFS.unlink(dir);
  run(`DELETE FROM songs WHERE id=?`, [id]);
  useMusic.getState().remove(id);
}
export async function updateSongMeta(args: {
  id: string;
  title?: string;
  artist?: string;
  album?: string;
  artworkBase64?: string;
}) {
  const existing = await fetchSong(args.id);
  if (!existing) throw new Error('Song not found');

  let artworkUri = existing.artwork;
  if (args.artworkBase64) {
    const aPath = PATHS.artwork(existing.id);
    await RNFS.writeFile(aPath, args.artworkBase64, 'base64');
    artworkUri = `file://${aPath}`;
  }

  const updated: Song = {
    ...existing,
    title: args.title ?? existing.title,
    artist: args.artist ?? existing.artist,
    album: args.album ?? existing.album,
    artwork: artworkUri,
  };

  run(
    `INSERT OR REPLACE INTO songs
     (id,title,artist,album,artwork,duration,createdAt,playCount,favorite,json)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      updated.id,
      updated.title,
      updated.artist ?? null,
      updated.album ?? null,
      updated.artwork ?? null,
      updated.duration ?? null,
      updated.createdAt,
      updated.playCount ?? 0,
      updated.favorite ? 1 : 0,
      JSON.stringify(updated),
    ]
  );
  useMusic.getState().replace(updated);
  return updated;
}

export async function updateSongLyrics(args: { id: string; lyrics: string[] }) {
  const existing = await fetchSong(args.id);
  if (!existing) throw new Error('Song not found');
  const updated: Song = { ...existing, lyrics: args.lyrics };

  try {
    const lPath = PATHS.lyrics(args.id);
    await RNFS.writeFile(lPath, args.lyrics.join('\n'), 'utf8');
  } catch {}

  run(
    `INSERT OR REPLACE INTO songs
     (id,title,artist,album,artwork,duration,createdAt,playCount,favorite,json)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      updated.id,
      updated.title,
      updated.artist ?? null,
      updated.album ?? null,
      updated.artwork ?? null,
      updated.duration ?? null,
      updated.createdAt,
      updated.playCount ?? 0,
      updated.favorite ? 1 : 0,
      JSON.stringify(updated),
    ]
  );
  useMusic.getState().replace(updated);
  return updated;
}

/* ───────── Stores ───────── */

type MusicState = {
  songs: Song[];
  refresh: () => Promise<void>;
  add: (s: Song) => void;
  remove: (id: string) => void;
  replace: (s: Song) => void;
};
export const useMusic = create<MusicState>((set, get) => ({
  songs: [],
  refresh: async () => set({ songs: await fetchSongs() }),
  add: (s) => set({ songs: [s, ...get().songs] }),
  remove: (id) => set({ songs: get().songs.filter((x) => x.id !== id) }),
  replace: (s) => set({ songs: get().songs.map((x) => (x.id === s.id ? s : x)) }),
}));

type PlayerState = {
  currentId: string | null;
  currentUri: string | null;
  isSetup: boolean;
  isPlaying: boolean;
  isLoading: boolean; // NEW: Loading state for smooth transitions
  duration: number;
  position: number;
  playlist: Song[];
  currentIndex: number;

  /** Full-screen player visibility */
  showFull: boolean;
  /** Mini is now derived from showFull, but we keep the flag for compatibility */
  showMini: boolean;

  activeVariant: Variant;

  // NEW: Professional seeking state management
  isSeeking: boolean;
  seekingPosition: number;
  wasPlayingBeforeSeek: boolean;

  setShowFull: (v: boolean) => void;
  setShowMini: (v: boolean) => void;
  setCurrent: (id: string | null, uri?: string | null) => void;
  setIsPlaying: (b: boolean) => void;
  setIsLoading: (b: boolean) => void; // NEW
  setSetup: (b: boolean) => void;
  setActiveVariant: (v: Variant) => void;
  setDuration: (d: number) => void;
  setPosition: (p: number) => void;
  setPlaylist: (songs: Song[], index?: number) => void;
  setCurrentIndex: (i: number) => void;

  // NEW: Professional seeking methods
  startSeeking: (position: number) => void;
  updateSeekPosition: (position: number) => void;
  finishSeeking: () => Promise<void>;
  cancelSeeking: () => void;
};

export const usePlayer = create<PlayerState>((set, get) => ({
  currentId: null,
  currentUri: null,
  isSetup: false,
  isPlaying: false,
  isLoading: false,
  duration: 0,
  position: 0,
  playlist: [],
  currentIndex: 0,

  showFull: false,
  showMini: true,

  activeVariant: 'full',

  // NEW: Seeking state
  isSeeking: false,
  seekingPosition: 0,
  wasPlayingBeforeSeek: false,

  setShowFull: (v) => set({ showFull: v, showMini: !v }),
  setShowMini: (v) => set({ showMini: v }),

  setCurrent: (id, uri = null) => set({ currentId: id, currentUri: uri }),
  setIsPlaying: (b) => set({ isPlaying: b }),
  setIsLoading: (b) => set({ isLoading: b }),
  setSetup: (b) => set({ isSetup: b }),
  setActiveVariant: (v) => set({ activeVariant: v }),
  setDuration: (d) => set({ duration: d }),
  setPosition: (p) => set({ position: p }),
  setPlaylist: (songs, index = 0) => set({ playlist: songs, currentIndex: index }),
  setCurrentIndex: (i) => set({ currentIndex: i }),

  // NEW: Professional seeking implementation
  startSeeking: (position) => {
    const state = get();
    set({
      isSeeking: true,
      seekingPosition: position,
      wasPlayingBeforeSeek: state.isPlaying,
    });
    // Auto-pause when seeking starts (standard behavior)
    if (state.isPlaying) {
      pauseAudio();
    }
  },

  updateSeekPosition: (position) => {
    set({ seekingPosition: position });
  },

  finishSeeking: async () => {
    const state = get();
    if (!state.isSeeking) return;

    try {
      // Seek to the final position
      await seekToPosition(state.seekingPosition);

      // Resume playback if was playing before
      if (state.wasPlayingBeforeSeek) {
        await resumeAudio();
      }
    } finally {
      set({
        isSeeking: false,
        position: state.seekingPosition,
        seekingPosition: 0,
        wasPlayingBeforeSeek: false,
      });
    }
  },

  cancelSeeking: () => {
    const state = get();
    // Resume if was playing before seeking started
    if (state.wasPlayingBeforeSeek) {
      resumeAudio();
    }
    set({
      isSeeking: false,
      seekingPosition: 0,
      wasPlayingBeforeSeek: false,
    });
  },
}));

// Global audio sound instance
let globalSound: Audio.Sound | null = null;
let positionUpdateInterval: any = null;

// Professional audio control functions
async function pauseAudio() {
  if (!globalSound) return;
  try {
    await globalSound.pauseAsync();
    usePlayer.getState().setIsPlaying(false);
  } catch (error) {
    console.error('Error pausing audio:', error);
  }
}

async function resumeAudio() {
  if (!globalSound) return;
  try {
    await globalSound.playAsync();
    usePlayer.getState().setIsPlaying(true);
  } catch (error) {
    console.error('Error resuming audio:', error);
  }
}

async function seekToPosition(seconds: number) {
  if (!globalSound) return;
  try {
    await globalSound.setPositionAsync(seconds * 1000);
    usePlayer.getState().setPosition(seconds);
  } catch (error) {
    console.error('Error seeking to position:', error);
  }
}

// Updated position updater that respects seeking state
function startPositionUpdater() {
  if (positionUpdateInterval) clearInterval(positionUpdateInterval);

  positionUpdateInterval = setInterval(async () => {
    const state = usePlayer.getState();

    // Don't update position while user is seeking
    if (state.isSeeking || !globalSound) return;

    try {
      const status = await globalSound.getStatusAsync();
      if (status.isLoaded) {
        const position = status.positionMillis ? status.positionMillis / 1000 : 0;
        const duration = status.durationMillis ? status.durationMillis / 1000 : 0;

        // Only update if not seeking to prevent UI conflicts
        if (!state.isSeeking) {
          state.setPosition(position);
          if (duration > 0) {
            state.setDuration(duration);
          }
          state.setIsPlaying(status.isPlaying || false);
          state.setIsLoading(false); // Clear loading state once playing
        }

        // Handle song completion (auto-advance)
        if (status.didJustFinish && !state.isSeeking) {
          handleSongCompletion();
        }
      }
    } catch (error) {
      console.error('Error updating position:', error);
    }
  }, 250); // Faster updates for smoother UI (250ms instead of 1000ms)
}

// Handle song completion with proper state management
async function handleSongCompletion() {
  const state = usePlayer.getState();
  state.setIsPlaying(false);

  // Auto-advance to next song if available
  if (state.currentIndex < state.playlist.length - 1) {
    await playNext();
  } else {
    // End of playlist - stop and reset position
    state.setPosition(0);
    stopPositionUpdater();
  }
}

function stopPositionUpdater() {
  if (positionUpdateInterval) {
    clearInterval(positionUpdateInterval);
    positionUpdateInterval = null;
  }
}

export async function setupAudioPlayerIfNeeded() {
  if (usePlayer.getState().isSetup) return;

  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    usePlayer.getState().setSetup(true);
  } catch (error) {
    console.error('Audio setup failed:', error);
  }
}

// PROFESSIONAL MUSIC PLAYER CONTROLS - replacing old optimistic functions

// Professional play/pause with proper state management
export async function togglePlayPause() {
  const state = usePlayer.getState();

  // Prevent rapid clicking during loading
  if (state.isLoading) return;

  if (!globalSound) {
    console.warn('No audio loaded');
    return;
  }

  try {
    state.setIsLoading(true);
    const status = await globalSound.getStatusAsync();

    if (status.isLoaded) {
      if (status.isPlaying) {
        await pauseAudio();
      } else {
        await resumeAudio();
        startPositionUpdater();
      }
    }
  } catch (error) {
    console.error('Error toggling play/pause:', error);
  } finally {
    state.setIsLoading(false);
  }
}

// Professional seeking with standard music player behavior
export function startSeeking(position: number) {
  const state = usePlayer.getState();
  state.startSeeking(position);
}

export function updateSeekPosition(position: number) {
  const state = usePlayer.getState();
  state.updateSeekPosition(position);
}

export async function finishSeeking() {
  const state = usePlayer.getState();
  await state.finishSeeking();
}

export function cancelSeeking() {
  const state = usePlayer.getState();
  state.cancelSeeking();
}

// Updated seekTo function for programmatic seeking
export async function seekTo(seconds: number) {
  if (!globalSound) return;

  try {
    await seekToPosition(seconds);
  } catch (error) {
    console.error('Error seeking:', error);
  }
}

// Professional next/previous with loading states
export async function playNext() {
  const state = usePlayer.getState();
  const { playlist, currentIndex, isLoading } = state;

  if (isLoading) return; // Prevent rapid clicking

  if (currentIndex < playlist.length - 1) {
    const nextSong = playlist[currentIndex + 1];
    state.setCurrentIndex(currentIndex + 1);
    state.setIsLoading(true);

    try {
      await playSongById(nextSong.id);
    } catch (error) {
      console.error('Error playing next song:', error);
      // Revert index on error
      state.setCurrentIndex(currentIndex);
    } finally {
      state.setIsLoading(false);
    }
  }
}

export async function playPrev() {
  const state = usePlayer.getState();
  const { playlist, currentIndex, position, isLoading } = state;

  if (isLoading) return; // Prevent rapid clicking

  // Standard behavior: if >3 seconds into song, restart current song
  if (position > 3) {
    await seekTo(0);
    return;
  }

  if (currentIndex > 0) {
    const prevSong = playlist[currentIndex - 1];
    state.setCurrentIndex(currentIndex - 1);
    state.setIsLoading(true);

    try {
      await playSongById(prevSong.id);
    } catch (error) {
      console.error('Error playing previous song:', error);
      // Revert index on error
      state.setCurrentIndex(currentIndex);
    } finally {
      state.setIsLoading(false);
    }
  } else {
    // Already at first song - restart current song
    await seekTo(0);
  }
}

// Create a hook that provides the global audio player
export function useGlobalAudioPlayer() {
  const currentUri = usePlayer((state) => state.currentUri);
  const isPlaying = usePlayer((state) => state.isPlaying);
  const duration = usePlayer((state) => state.duration);
  const position = usePlayer((state) => state.position);

  return {
    player: globalSound,
    status: {
      isLoaded: !!globalSound,
      isPlaying: isPlaying,
      playing: isPlaying, // Add this for compatibility
      duration: duration,
      currentTime: position,
      positionMillis: position * 1000,
      durationMillis: duration * 1000,
      didJustFinish: false, // We'll handle this in the callback
    },
  };
}

function getVariantUri(song: Song, variant: Variant): string {
  const audioFile =
    variant === 'full'
      ? song.variants.full
      : variant === 'vocals'
        ? song.variants.vocals
        : song.variants.instrumental;

  if (!audioFile) throw new Error(`Variant ${variant} not available`);
  return audioFile.uri;
}

export async function playSongById(id: string) {
  await setupAudioPlayerIfNeeded();
  const lib = useMusic.getState().songs;
  const idx = lib.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error('Song not found');

  const song = lib[idx];
  const uri = getVariantUri(song, 'full');

  try {
    console.log('Playing audio file:', uri);

    // Stop and unload current sound if playing
    if (globalSound) {
      await globalSound.unloadAsync();
      stopPositionUpdater();
      globalSound = null;
    }

    // Create new sound - let expo-av handle validation
    const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true }, (status) => {
      if (status.isLoaded) {
        const position = status.positionMillis ? status.positionMillis / 1000 : 0;
        const duration = status.durationMillis ? status.durationMillis / 1000 : 0;
        usePlayer.getState().setPosition(position);
        if (duration > 0) {
          usePlayer.getState().setDuration(duration);
        }
        usePlayer.getState().setIsPlaying(status.isPlaying || false);

        // Handle playback completion
        if (status.didJustFinish) {
          playNext().catch(() => {});
        }
      }
    });

    globalSound = sound;
    startPositionUpdater();

    // Update state
    usePlayer.getState().setCurrent(id, uri);
    usePlayer.getState().setPlaylist(lib, idx);
    usePlayer.getState().setActiveVariant('full');
    usePlayer.getState().setIsPlaying(true);

    // Set duration if available from song metadata
    if (song.duration) {
      usePlayer.getState().setDuration(song.duration);
    }

    console.log('Successfully started playback for:', song.title);
  } catch (error) {
    console.error('Error playing song:', error);
    throw error;
  }
}

// Hook to get current player status - this replaces useProgress from track player
export function useProgress() {
  const position = usePlayer((state) => state.position);
  const duration = usePlayer((state) => state.duration);
  return { position, duration };
}

// Hook to get current playback state - this replaces usePlaybackState from track player
export function usePlaybackState() {
  const isPlaying = usePlayer((state) => state.isPlaying);
  return { state: isPlaying ? 'playing' : 'paused' };
}

// Hook to get current player status with professional state management
export function usePlayerStatus() {
  const isPlaying = usePlayer((state) => state.isPlaying);
  const isLoading = usePlayer((state) => state.isLoading);
  const isSeeking = usePlayer((state) => state.isSeeking);
  const seekingPosition = usePlayer((state) => state.seekingPosition);
  const duration = usePlayer((state) => state.duration);
  const position = usePlayer((state) => state.position);
  const currentId = usePlayer((state) => state.currentId);
  const activeVariant = usePlayer((state) => state.activeVariant);

  return {
    isPlaying,
    isLoading,
    isSeeking,
    seekingPosition,
    duration,
    position: isSeeking ? seekingPosition : position, // Show seeking position during seek
    currentId,
    activeVariant,
  };
}

/* ───────── Lyrics IO ───────── */

export async function loadLyricsFromDisk(id: string) {
  try {
    const p = PATHS.lyrics(id);
    if (!(await RNFS.exists(p))) return null;
    const txt = await RNFS.readFile(p, 'utf8');
    return txt.split('\n');
  } catch {
    return null;
  }
}

/* ───────── Backend helpers ───────── */

const RAW = (process.env.EXPO_PUBLIC_BACKEND_URL as string) || 'http://localhost:3000';
const BASE = RAW.replace(/\/+$/, '');

export function hasStems(s?: Song | null) {
  return !!(s && s.variants.vocals?.uri && s.variants.instrumental?.uri);
}

// Professional variant switching (removing old optimistic system)
export async function playVariantForCurrent(v: Variant) {
  await setupAudioPlayerIfNeeded();

  const state = usePlayer.getState();
  const { currentId, isLoading } = state;

  if (!currentId || isLoading) return;

  const song = await fetchSong(currentId);
  if (!song) return;
  if (v !== 'full' && !hasStems(song)) return;

  // Set loading state for smooth transition
  state.setIsLoading(true);
  const wasPlaying = state.isPlaying;

  try {
    // Stop current playback
    if (globalSound) {
      await globalSound.unloadAsync();
      stopPositionUpdater();
      globalSound = null;
    }

    // Load new variant
    const uri = getVariantUri(song, v);
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: wasPlaying }, // Resume if was playing
      (status) => {
        if (status.isLoaded) {
          const position = status.positionMillis ? status.positionMillis / 1000 : 0;
          const duration = status.durationMillis ? status.durationMillis / 1000 : 0;

          if (!state.isSeeking) {
            state.setPosition(position);
            if (duration > 0) {
              state.setDuration(duration);
            }
            state.setIsPlaying(status.isPlaying || false);
          }

          if (status.didJustFinish && !state.isSeeking) {
            handleSongCompletion();
          }
        }
      }
    );

    globalSound = sound;
    if (wasPlaying) {
      startPositionUpdater();
    }

    // Update state
    state.setCurrent(currentId, uri);
    state.setActiveVariant(v);
    state.setIsPlaying(wasPlaying);
  } catch (error) {
    console.error('Error switching variant:', error);
  } finally {
    state.setIsLoading(false);
  }
}

/* upload/poll/result functions unchanged */

export async function uploadForSeparation(songId: string, onProgress?: (pct: number) => void) {
  const s = await fetchSong(songId);
  if (!s) throw new Error('Song not found');
  const file = s.variants.full;

  const form = new FormData();
  form.append(
    'file' as any,
    {
      uri: file.uri,
      type: file.mime || 'audio/mpeg',
      name: `${songId}.mp3`,
    } as any
  );
  form.append('songId', songId);

  let pct = 1;
  const tick = setInterval(() => {
    pct = Math.min(95, pct + 1 + Math.floor(Math.random() * 3));
    onProgress?.(pct);
  }, 180);

  try {
    const res = await fetch(`${BASE}/upload_music`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: form as any,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    onProgress?.(100);
  } finally {
    clearInterval(tick);
  }
}

export async function pollStemsState(id: string) {
  const r = await fetch(`${BASE}/stems/${encodeURIComponent(id)}/state`);
  const j = await r.json();
  return {
    state: j?.state as string | undefined,
    progress: j?.progress as number | undefined,
    ready: !!j?.ready,
    available: !!j?.available,
    expiresAt: (j?.expiresAt as number | null | undefined) ?? null,
  };
}
export async function fetchStemsResult(id: string) {
  const r = await fetch(`${BASE}/stems/${encodeURIComponent(id)}/result`);
  return (await r.json()) as {
    ready: boolean;
    available: boolean;
    vocalsUrl?: string;
    accompanimentUrl?: string;
    instrumentalUrl?: string;
    expiresAt?: number | null;
  };
}

export async function downloadStemsToLibrary(args: {
  id: string;
  vocalsUrl: string;
  instrumentalUrl: string;
}) {
  await ensureInit();
  const s = await fetchSong(args.id);
  if (!s) throw new Error('Song not found');

  const extFrom = (u: string) =>
    (u.match(/\.(m4a|mp3|wav|aac|caf)(?:\?|#|$)/i)?.[1] || 'm4a').toLowerCase() as
      | 'm4a'
      | 'mp3'
      | 'wav'
      | 'aac'
      | 'caf';

  const vExt = extFrom(args.vocalsUrl);
  const iExt = extFrom(args.instrumentalUrl);
  const vPath = PATHS.variant(s.id, 'vocals', vExt);
  const iPath = PATHS.variant(s.id, 'instrumental', iExt);

  const dir = PATHS.songDir(s.id);
  if (!(await RNFS.exists(dir))) await RNFS.mkdir(dir);

  await RNFS.downloadFile({ fromUrl: args.vocalsUrl, toFile: vPath }).promise;
  await RNFS.downloadFile({ fromUrl: args.instrumentalUrl, toFile: iPath }).promise;

  const vocals: AudioFile = {
    uri: `file://${vPath}`,
    mime: vExt === 'm4a' ? 'audio/mp4' : vExt === 'mp3' ? 'audio/mpeg' : 'audio/wav',
    size: Number((await RNFS.stat(vPath)).size) || 0,
    duration: s.variants.full.duration,
  };
  const instrumental: AudioFile = {
    uri: `file://${iPath}`,
    mime: iExt === 'm4a' ? 'audio/mp4' : iExt === 'mp3' ? 'audio/mpeg' : 'audio/wav',
    size: Number((await RNFS.stat(iPath)).size) || 0,
    duration: s.variants.full.duration,
  };

  const updated: Song = {
    ...s,
    variants: { ...s.variants, vocals, instrumental },
  };

  run(
    `INSERT OR REPLACE INTO songs
     (id,title,artist,album,artwork,duration,createdAt,playCount,favorite,json)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      updated.id,
      updated.title,
      updated.artist ?? null,
      updated.album ?? null,
      updated.artwork ?? null,
      updated.duration ?? null,
      updated.createdAt,
      updated.playCount ?? 0,
      updated.favorite ? 1 : 0,
      JSON.stringify(updated),
    ]
  );
  useMusic.getState().replace(updated);

  try {
    await fetch(`${BASE}/stems/${encodeURIComponent(s.id)}/cleanup`, {
      method: 'POST',
    });
  } catch {}

  return updated;
}

// Add this test function to verify the player works with valid audio
export async function testPlayback() {
  // This is a tiny valid MP3 file (silence) for testing
  const validMP3Base64 =
    'SUQzAwAAAAAAS1RJVDEAAAAHAAAATm90aGluZ1RQRTEAAAAIAAAATm90aGluZ1RSQ0sAAAABAAAAMVRDT04AAAAFAAAAT3RoZXJUWUVSAAAABAAAADE5OTlUQUxCAAAABwAAAE5vdGhpbmdUUE9TMQAAAAEAAAAxVFBPUzIAAAABAAAAMVRQT1MzAAAABgAAAU5vdGhpbmd//+QxAAFAAAdRCAAAAP///////////////////////////';

  try {
    console.log('Testing with valid MP3...');
    const testSong = await saveBase64AsSong({
      base64: validMP3Base64,
      title: 'Test Audio',
      artist: 'Test',
      ext: 'mp3',
      mime: 'audio/mpeg',
    });

    console.log('Test song saved, attempting playback...');
    await playSongById(testSong.id);
    console.log('✅ Playback works! The issue is your backend audio data.');
  } catch (error) {
    console.error('❌ Even test file failed:', error);
  }
}

export default {};
