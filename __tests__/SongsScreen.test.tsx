// __tests__/SongsScreen.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import SongsScreen from '@/app/index';

// Mock the music player controls
jest.mock('@/lib/music-player-all-controls', () => ({
  useMusic: (selector: any) =>
    selector({
      songs: [
        {
          id: 'song-1',
          title: 'Test Song',
          artist: 'Test Artist',
          album: 'Test Album',
          duration: 180,
        },
      ],
      refresh: jest.fn(),
    }),
  playSongById: jest.fn(),
  removeSong: jest.fn(),
  updateSongMeta: jest.fn(),
}));

// Mock ActionSheetIOS
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    ActionSheetIOS: {
      showActionSheetWithOptions: jest.fn(),
    },
  };
});

describe('SongsScreen', () => {
  it('renders search input', () => {
    render(<SongsScreen />);
    expect(screen.getByPlaceholderText('Search songs, artists, albums…')).toBeTruthy();
  });

  it('displays songs from store', () => {
    render(<SongsScreen />);
    expect(screen.getByText('Test Song')).toBeTruthy();
    expect(screen.getByText('Test Artist')).toBeTruthy();
  });

  it('shows empty state when no songs', () => {
    // Override mock for this test
    jest
      .spyOn(require('@/lib/music-player-all-controls'), 'useMusic')
      .mockImplementation((selector: any) =>
        selector({
          songs: [],
          refresh: jest.fn(),
        })
      );

    render(<SongsScreen />);
    expect(screen.getByText('No songs yet')).toBeTruthy();
    expect(screen.getByText('Use the Download tab to save music.')).toBeTruthy();
  });

  it('formats duration correctly', () => {
    render(<SongsScreen />);
    // 180 seconds = 3:00
    expect(screen.getByText('3:00')).toBeTruthy();
  });
});
