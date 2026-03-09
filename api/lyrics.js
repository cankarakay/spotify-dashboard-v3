module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { artist, title } = req.query;
  if (!artist || !title) return res.status(400).json({ error: 'artist and title required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `"${title}" by ${artist} şarkısının sözlerini yaz. Sadece sözleri yaz, başka hiçbir şey ekleme. Eğer bu şarkıyı bilmiyorsan sadece "UNKNOWN" yaz.`
        }]
      })
    });

    const data = await response.json();
    const lyrics = data.content?.[0]?.text || '';

    if (lyrics === 'UNKNOWN' || lyrics.length < 30) {
      return res.status(404).json({ error: 'Şarkı sözleri bulunamadı' });
    }

    return res.status(200).json({ lyrics, source: 'claude' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
