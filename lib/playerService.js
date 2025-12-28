// lib/playerService.js

// import TrackPlayer, { Event } from "react-native-track-player";

// /**
//  * This synchronous function is what RNTP expects.
//  * All async work stays inside the individual event callbacks.
//  */
// export default function playbackService() {
//   /** === lock-screen / Control-Centre controls === */
//   TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
//   TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
//   TrackPlayer.addEventListener(Event.RemoteNext, () =>
//     TrackPlayer.skipToNext()
//   );
//   TrackPlayer.addEventListener(Event.RemotePrevious, () =>
//     TrackPlayer.skipToPrevious()
//   );

//   /** Jump  ♻️  */
//   TrackPlayer.addEventListener(Event.RemoteJumpForward, async (e) => {
//     const pos = await TrackPlayer.getPosition();
//     await TrackPlayer.seekTo(pos + (e.interval || 15));
//   });
//   TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (e) => {
//     const pos = await TrackPlayer.getPosition();
//     await TrackPlayer.seekTo(Math.max(0, pos - (e.interval || 15)));
//   });

//   /** Scrubbing */
//   TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) =>
//     TrackPlayer.seekTo(position)
//   );

//   /** House-keeping listeners (optional) */
//   TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
//     /* loop / reset logic */
//   });
//   TrackPlayer.addEventListener(Event.PlaybackError, (err) =>
//     console.error("RNTP error", err)
//   );
// }

// module.exports = playbackService; // ← add this line

// lib/playerService.js
import TrackPlayer, { Event, State } from 'react-native-track-player';

/**
 * Enhanced playback service with detailed error logging
 */
export default function playbackService() {
  console.log('=== PLAYBACK SERVICE INITIALIZED ===');

  /** === Remote control events === */
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    console.log('🎮 Remote play triggered');
    try {
      await TrackPlayer.play();
      console.log('✅ Remote play successful');
    } catch (error) {
      console.error('❌ Remote play failed:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    console.log('🎮 Remote pause triggered');
    try {
      await TrackPlayer.pause();
      console.log('✅ Remote pause successful');
    } catch (error) {
      console.error('❌ Remote pause failed:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    console.log('🎮 Remote next triggered');
    try {
      await TrackPlayer.skipToNext();
      console.log('✅ Remote next successful');
    } catch (error) {
      console.error('❌ Remote next failed:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    console.log('🎮 Remote previous triggered');
    try {
      await TrackPlayer.skipToPrevious();
      console.log('✅ Remote previous successful');
    } catch (error) {
      console.error('❌ Remote previous failed:', error);
    }
  });

  /** Jump controls with error handling */
  TrackPlayer.addEventListener(Event.RemoteJumpForward, async (e) => {
    console.log('🎮 Remote jump forward triggered:', e.interval);
    try {
      const pos = await TrackPlayer.getPosition();
      console.log('Current position:', pos);
      const newPos = pos + (e.interval || 15);
      await TrackPlayer.seekTo(newPos);
      console.log('✅ Jumped forward to:', newPos);
    } catch (error) {
      console.error('❌ Jump forward failed:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (e) => {
    console.log('🎮 Remote jump backward triggered:', e.interval);
    try {
      const pos = await TrackPlayer.getPosition();
      console.log('Current position:', pos);
      const newPos = Math.max(0, pos - (e.interval || 15));
      await TrackPlayer.seekTo(newPos);
      console.log('✅ Jumped backward to:', newPos);
    } catch (error) {
      console.error('❌ Jump backward failed:', error);
    }
  });

  /** Seek control */
  TrackPlayer.addEventListener(Event.RemoteSeek, async ({ position }) => {
    console.log('🎮 Remote seek triggered to:', position);
    try {
      await TrackPlayer.seekTo(position);
      console.log('✅ Seek successful');
    } catch (error) {
      console.error('❌ Seek failed:', error);
    }
  });

  /** Enhanced error handling */
  TrackPlayer.addEventListener(Event.PlaybackError, (error) => {
    console.error('=== PLAYBACK SERVICE ERROR ===');
    console.error('Full error object:', JSON.stringify(error, null, 2));
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error type:', error.type);

    // Try to get more context
    TrackPlayer.getActiveTrack()
      .then((track) => {
        console.error('Active track during error:', track);
        if (track?.url) {
          console.error('Failed track URL:', track.url);

          // Check if it's a local file and log more details
          if (track.url.startsWith('file://')) {
            console.error('🗂️ LOCAL FILE ERROR');
            console.error('File path:', track.url);
            console.error('File extension:', track.url.split('.').pop());
          }
        }
      })
      .catch((trackError) => {
        console.error('Could not get active track:', trackError);
      });

    TrackPlayer.getState()
      .then((state) => {
        console.error('Player state during error:', state);
      })
      .catch((stateError) => {
        console.error('Could not get player state:', stateError);
      });

    // Get queue info
    TrackPlayer.getQueue()
      .then((queue) => {
        console.error('Queue length during error:', queue.length);
        console.error(
          'Queue tracks:',
          queue.map((t) => ({ id: t.id, title: t.title, url: t.url }))
        );
      })
      .catch((queueError) => {
        console.error('Could not get queue:', queueError);
      });
  });

  /** Queue end handling */
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
    console.log('🔚 Playback queue ended');
  });

  /** Track change monitoring */
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (event) => {
    if (event.track) {
      console.log('New track:', {
        id: event.track.id,
        title: event.track.title,
        url: event.track.url,
      });
    }
  });

  /** State change monitoring */
  TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
    console.log('🎵 Playback state changed in service:', event.state);

    if (event.state === State.Error) {
      console.error('=== PLAYER ENTERED ERROR STATE ===');
      // Additional debugging when entering error state
      TrackPlayer.getActiveTrack()
        .then((track) => {
          console.error('Track in error state:', track);
          if (track?.url?.startsWith('file://')) {
            console.error('❌ LOCAL FILE PLAYBACK ERROR');
            console.error('Problem file:', track.url);
          }
        })
        .catch((e) => {
          console.error('Could not get track in error state:', e);
        });
    }

    if (event.state === State.Ready) {
      console.log('✅ Player is ready');
    }

    if (event.state === State.Playing) {
      console.log('▶️ Playback started');
    }

    if (event.state === State.Paused) {
      console.log('⏸️ Playback paused');
    }

    if (event.state === State.Stopped) {
      console.log('⏹️ Playback stopped');
    }

    if (event.state === State.Loading) {
      console.log('⏳ Loading track...');
    }

    if (event.state === State.Buffering) {
      console.log('🔄 Buffering...');
    }
  });

  /** Track metadata updates */
  TrackPlayer.addEventListener(Event.PlaybackMetadataReceived, (event) => {
    console.log('📋 Metadata received:', event);
  });

  /** Progress updates (optional - can be noisy) */
  // TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (event) => {
  //   console.log("⏱️ Progress:", event.position, "/", event.duration);
  // });

  console.log('=== PLAYBACK SERVICE SETUP COMPLETE ===');
}

module.exports = playbackService;
