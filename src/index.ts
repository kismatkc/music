import express from 'express';
import tracksRoute from './routes/tracks';
import playlistsRoute from './routes/playlists';
import albumsRoute from './routes/albums';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/tracks', tracksRoute);
app.use('/api/playlists', playlistsRoute);
app.use('/api/albums', albumsRoute);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
