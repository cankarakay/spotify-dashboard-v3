module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { artist, title } = req.query;
  if (!artist || !title) return res.status(400).json({ error: 'required' });

  // Remaster/live/edition gibi ekleri temizle
  const cleanTitle = title
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/- ?(remaster|live|edition|version|remix|mix|mono|stereo|bonus).*/gi, '')
    .trim();

  return res.status(200).json({
    lyrics: `${cleanTitle} - ${artist}`,
    source: 'direct',
    cleanTitle,
    cleanArtist: artist
  });
};
