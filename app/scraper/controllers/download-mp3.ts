// app/scraper/controllers/download-mp3.ts

function runYtDlpAudio(videoUrl: string, onProgress: (f: number) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Use a temporary file instead of stdout to avoid corruption
    const tempFile = `/tmp/audio_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;

    const args = [
      ...COMMON_ARGS,
      '-f',
      'bestaudio/best',
      '-x',
      '--audio-format',
      'mp3',
      '--audio-quality',
      '0', // Best quality
      '--no-playlist',
      '--no-warnings', // Reduce stderr noise
      '--no-progress', // We'll track our own progress
      '-o',
      tempFile, // Output to temp file instead of stdout
      videoUrl,
    ];

    console.log('[yt-dlp] Running command:', 'yt-dlp', args.join(' '));
    const proc = spawn('yt-dlp', args);

    let errText = '';
    let progressReported = 0;

    proc.stderr.on('data', (d) => {
      const text = d.toString();
      errText += text;

      // Parse progress like: [download]  42.3% ...
      const m = text.match(/\[download\]\s+([0-9.]+)%/);
      if (m) {
        const pct = parseFloat(m[1]);
        if (!Number.isNaN(pct) && pct > progressReported) {
          progressReported = pct;
          onProgress(pct / 100);
        }
      }
    });

    proc.on('error', (err) => {
      console.error('[yt-dlp] Process error:', err);
      reject(err);
    });

    proc.on('close', async (code) => {
      if (code !== 0) {
        console.error('[yt-dlp] Exit code:', code);
        console.error('[yt-dlp] Error output:', errText);
        return reject(new Error(`yt-dlp download failed (code ${code}): ${errText}`));
      }

      try {
        // Read the downloaded file
        const fs = require('fs');
        const fileBuffer = fs.readFileSync(tempFile);

        // Clean up temp file
        fs.unlinkSync(tempFile);

        console.log(
          '[yt-dlp] Successfully downloaded audio file, size:',
          fileBuffer.length,
          'bytes'
        );

        // Verify it's actually an MP3 file
        if (fileBuffer.length < 1024) {
          throw new Error('Downloaded file is too small to be valid audio');
        }

        // Check for MP3 header
        const header = fileBuffer.slice(0, 3);
        if (header[0] === 0xff && (header[1] & 0xe0) === 0xe0) {
          console.log('[yt-dlp] Valid MP3 header detected');
        } else if (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) {
          console.log('[yt-dlp] Valid ID3 header detected');
        } else {
          console.warn('[yt-dlp] Warning: Unexpected file header, but proceeding anyway');
          console.warn(
            '[yt-dlp] First 16 bytes:',
            Array.from(fileBuffer.slice(0, 16))
              .map((b) => b.toString(16).padStart(2, '0'))
              .join(' ')
          );
        }

        resolve(fileBuffer);
      } catch (fileError) {
        console.error('[yt-dlp] File read error:', fileError);
        reject(new Error(`Failed to read downloaded audio file: ${fileError.message}`));
      }
    });
  });
} // app/scraper/controllers/download-mp3.ts
