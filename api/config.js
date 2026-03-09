export default function handler(req, res) {
  res.status(200).json({
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID || ''
  });
}
