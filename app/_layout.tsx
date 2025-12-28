// app/_layout.tsx

import * as React from 'react';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ensureInit, setupAudioPlayerIfNeeded } from '@/lib/music-player-all-controls';
import MiniPlayer from '@/components/MiniPlayer';
import FullPlayer from '@/components/MainPlayer';

export default function MusicLayout() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <MusicLayoutContent />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

function MusicLayoutContent() {
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    (async () => {
      await ensureInit();
      await setupAudioPlayerIfNeeded();
    })();
  }, []);

  // Expo's default tab bar height is ~56. Add a little spacing.
  const TAB_BAR_HEIGHT = 56;
  const MINI_SAFE_BOTTOM = insets.bottom + TAB_BAR_HEIGHT + 8;

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#0f1115',
            borderTopColor: '#151a23',
          },
          tabBarActiveTintColor: '#60a5fa',
          tabBarInactiveTintColor: '#9aa0a6',
          // Remove the static paddingTop since we're handling safe areas properly now
          sceneStyle: {
            paddingTop: insets.top + 8, // Dynamic safe area top + small margin
          },
        }}>
        {/* Songs tab */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Songs',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="musical-notes-outline" size={size} color={color} />
            ),
          }}
        />

        {/* Lyrics tab */}
        <Tabs.Screen
          name="lyrics/index"
          options={{
            title: 'Lyrics',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="document-text-outline" size={size} color={color} />
            ),
          }}
        />

        {/* Download tab */}
        <Tabs.Screen
          name="download/index"
          options={{
            title: 'Download',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="download-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>

      {/* Keep mini mounted; it hides itself when the full player is open */}
      <MiniPlayer
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: MINI_SAFE_BOTTOM,
          zIndex: 50,
          pointerEvents: 'box-none',
        }}
      />

      <FullPlayer />
    </>
  );
}
