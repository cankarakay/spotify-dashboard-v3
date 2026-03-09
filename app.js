
// ══════════════════════════════════════════════════════
let currentPeriod = 'weekly';
let timelineInitialized = false;

function setTimelinePeriod(period, btn) {
  currentPeriod = period;
  document.querySelectorAll('.tl-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const descs = {
    weekly: 'Son 7 gunun ruh hali degisimi',
    monthly: 'Son 4 haftalik ruh hali degisimi',
    yearly: 'Son 12 aylik ruh hali degisimi'
  };
  document.getElementById('tl-desc').textContent = descs[period];
  timelineInitialized = false;
  initTimeline();
}

function initTimeline() {
  if (timelineInitialized) return;
  timelineInitialized = true;

  const data = cachedData[currentTimeRange];
  if (!data || !data.recent.length) {
    document.getElementById('tl-chart-wrap').innerHTML =
      '<div class="tl-no-data">Yeterli dinleme verisi bulunamadi. Spotify kullanimi arttikca veriler dolacak.</div>';
    return;
  }

  const groups = groupByPeriod(data.recent, currentPeriod);
  if (Object.keys(groups).length < 2) {
    document.getElementById('tl-chart-wrap').innerHTML =
      '<div class="tl-no-data">Bu gorunum icin yeterli veri yok. Haftalik secimini dene.</div>';
    return;
  }

  const scored = scoreGroups(groups);
  renderTimelineChart(scored);
  renderTimelineStats(scored);
  renderTimelineClaude(scored, data.artists);
}

function groupByPeriod(recent, period) {
  const groups = {};
  const now = new Date();

  recent.forEach(item => {
    const d = new Date(item.played_at);
    let key, label;

    if (period === 'weekly') {
      // Group by day, last 7 days
      const diffDays = Math.floor((now - d) / 86400000);
      if (diffDays > 6) return;
      const dayNames = ['Paz','Pzt','Sal','Car','Per','Cum','Cmt'];
      label = dayNames[d.getDay()] + ' ' + d.getDate();
      key = d.toISOString().slice(0, 10);
    } else if (period === 'monthly') {
      // Group by week, last 4 weeks
      const diffDays = Math.floor((now - d) / 86400000);
      if (diffDays > 27) return;
      const weekNum = Math.floor(diffDays / 7);
      key = 'week_' + weekNum;
      label = weekNum === 0 ? 'Bu Hafta' : weekNum + '. Hafta Once';
    } else {
      // Group by month, last 12 months
      const diffMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (diffMonths > 11) return;
      const monthNames = ['Oca','Sub','Mar','Nis','May','Haz','Tem','Agu','Eyl','Eki','Kas','Ara'];
      key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      label = monthNames[d.getMonth()] + ' ' + d.getFullYear();
    }

    if (!groups[key]) groups[key] = { label, tracks: [], key };
    groups[key].tracks.push(item.track);
  });

  return groups;
}

function scoreGroups(groups) {
  return Object.entries(groups)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, g]) => {
      const tracks = g.tracks;
      const avgPop = tracks.reduce((s, t) => s + (t.popularity || 50), 0) / tracks.length;
      // Explicit ratio (higher = more intense/aggressive)
      const explicitRatio = tracks.filter(t => t.explicit).length / tracks.length;
      // Duration proxy (longer songs = more mellow)
      const avgDur = tracks.reduce((s, t) => s + t.duration_ms, 0) / tracks.length;
      // Mood score: blend of popularity + inverse explicit + duration factor
      const moodScore = Math.round(
        avgPop * 0.6 +
        (1 - explicitRatio) * 30 +
        Math.min(avgDur / 300000, 1) * 10
      );
      return {
        key,
        label: g.label,
        score: Math.min(100, Math.max(0, moodScore)),
        trackCount: tracks.length,
        topTracks: tracks.slice(0, 3).map(t => t.name).join(', '),
        avgPop: Math.round(avgPop),
        explicit: Math.round(explicitRatio * 100)
      };
    });
}

function renderTimelineChart(scored) {
  const wrap = document.getElementById('tl-chart-wrap');
  const W = wrap.clientWidth || 600;
  const H = 200;
  const padL = 40, padR = 20, padT = 20, padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const minScore = Math.min(...scored.map(s => s.score));
  const maxScore = Math.max(...scored.map(s => s.score));
  const scoreRange = maxScore - minScore || 1;

  const pts = scored.map((s, i) => ({
    x: padL + (i / Math.max(scored.length - 1, 1)) * chartW,
    y: padT + (1 - (s.score - minScore) / scoreRange) * chartH,
    ...s
  }));

  // Build SVG
  let svg = `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;

  // Grid lines
  for (let i = 0; i <= 4; i++) {
    const y = padT + (i / 4) * chartH;
    const val = Math.round(maxScore - (i / 4) * scoreRange);
    svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`;
    svg += `<text x="${padL - 6}" y="${y + 4}" fill="rgba(255,255,255,0.3)" font-size="10" text-anchor="end">${val}</text>`;
  }

  // Gradient fill under line
  const pathD = pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
  const fillD = pathD + ` L${pts[pts.length-1].x},${padT+chartH} L${pts[0].x},${padT+chartH} Z`;
  svg += `<defs>
    <linearGradient id="tlGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1DB954" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#1DB954" stop-opacity="0"/>
    </linearGradient>
  </defs>`;
  svg += `<path d="${fillD}" fill="url(#tlGrad)"/>`;

  // Smooth line
  svg += `<polyline points="${pts.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="#1DB954" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;

  // Dots + labels
  pts.forEach((p, i) => {
    const isMax = p.score === maxScore;
    const isMin = p.score === minScore;
    const dotColor = isMax ? '#1DB954' : isMin ? '#ff6b6b' : '#fff';
    svg += `<circle cx="${p.x}" cy="${p.y}" r="${isMax || isMin ? 6 : 4}" fill="${dotColor}" stroke="var(--bg)" stroke-width="2"/>`;
    // Score label on dot
    svg += `<text x="${p.x}" y="${p.y - 10}" fill="rgba(255,255,255,0.7)" font-size="10" text-anchor="middle">${p.score}</text>`;
    // X axis label
    const xLabel = p.label.length > 8 ? p.label.slice(0, 7) + '...' : p.label;
    svg += `<text x="${p.x}" y="${H - 5}" fill="rgba(255,255,255,0.4)" font-size="10" text-anchor="middle">${xLabel}</text>`;
  });

  svg += '</svg>';
  wrap.innerHTML = `<div class="tl-canvas-wrap">${svg}</div>`;
}

function renderTimelineStats(scored) {
  const best = scored.reduce((a, b) => a.score > b.score ? a : b);
  const worst = scored.reduce((a, b) => a.score < b.score ? a : b);

  document.getElementById('tl-best').innerHTML = `
    <div class="tl-stat-period"> ${best.label}</div>
    <div class="tl-stat-score">${best.score}</div>
    <div class="tl-stat-tracks">${best.trackCount} sarki - Ort. populerlik: ${best.avgPop}<br>
    <span style="color:var(--muted)">${best.topTracks}</span></div>`;

  document.getElementById('tl-worst').innerHTML = `
    <div class="tl-stat-period" style="color:var(--accent)"> ${worst.label}</div>
    <div class="tl-stat-score" style="color:var(--accent)">${worst.score}</div>
    <div class="tl-stat-tracks">${worst.trackCount} sarki - Ort. populerlik: ${worst.avgPop}<br>
    <span style="color:var(--muted)">${worst.topTracks}</span></div>`;
}

async function renderTimelineClaude(scored, artists) {
  const el = document.getElementById('tl-claude-analysis');

  const trendData = scored.map(s =>
    `${s.label}: ruh hali skoru ${s.score}/100, ${s.trackCount} sarki, ort. populerlik ${s.avgPop}`
  ).join('\n');

  const genreList = [...new Set((artists || []).flatMap(a => a.genres || []))].slice(0, 6).join(', ');

  const periodLabel = currentPeriod === 'weekly' ? 'gunluk' : currentPeriod === 'monthly' ? 'haftalik' : 'aylik';
  const prompt = `Bir kullanicinin ${periodLabel} muzik dinleme ruh hali verileri:

${trendData}

Favori turler: ${genreList || 'bilinmiyor'}

Bu zaman serisini analiz et. Trendleri, degisimleri ve olasi sebepleri yorumla.

JSON formatinda dondur, baska hicbir sey yazma:
{
  "trend": "(Yukseliyor / Dususyor / Stabil / Dalgali)",
  "trend_emoji": "(tek emoji)",
  "ozet": "(3-4 cumle: zaman icindeki ruh hali degisimini ve olasi yorumunu anlat)",
  "en_ilginc": "(en dikkat cekici degisim veya nokta hakkinda 1-2 cumle)",
  "oneri": "(bu trende gore kullaniciya 1 oneri)"
}`;

  try {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(typeof data.error === 'object' ? JSON.stringify(data.error) : data.error);

    const text = data.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON bulunamadi');
    const r = JSON.parse(jsonMatch[0]);

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem">
        <span style="font-size:2.5rem">${r.trend_emoji}</span>
        <div>
          <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:1.1rem">${r.trend}</div>
          <div style="color:var(--muted);font-size:0.8rem">Genel trend</div>
        </div>
      </div>
      <div class="tl-trend-text">${r.ozet}</div>
      <div style="margin-top:1.2rem;padding:1rem;background:var(--surface2);border-radius:12px;border-left:3px solid var(--green)">
        <div style="font-size:0.75rem;color:var(--green);font-family:'Syne',sans-serif;font-weight:700;margin-bottom:0.4rem">EN ILGINC NOKTA</div>
        <div style="font-size:0.88rem;color:#ddd">${r.en_ilginc}</div>
      </div>
      <div style="margin-top:1rem;padding:1rem;background:rgba(29,185,84,0.06);border-radius:12px;border-left:3px solid rgba(29,185,84,0.4)">
        <div style="font-size:0.75rem;color:var(--green);font-family:'Syne',sans-serif;font-weight:700;margin-bottom:0.4rem">💡 ONERI</div>
        <div style="font-size:0.88rem;color:#ddd">${r.oneri}</div>
      </div>`;

  } catch(err) {
    el.innerHTML = `<div class="sentiment-error">Trend analizi yapilamadi: ${err.message}</div>`;
  }
}


// ══════════════════════════════════════════════════════
//  HOURLY TIMELINE
// ══════════════════════════════════════════════════════
function renderHourlyTimeline(recent) {
  const wrap = document.getElementById('tl-chart-wrap');
  const countEl = document.getElementById('tl-track-count');
  if (!wrap) return;

  if (!recent || !recent.length) {
    wrap.innerHTML = '<div class="tl-no-data">Yeterli dinleme verisi bulunamadi.</div>';
    return;
  }

  // Group by hour (0-23)
  const hours = Array.from({length: 24}, (_, i) => ({ hour: i, tracks: [], score: 0 }));
  recent.forEach(item => {
    const h = new Date(item.played_at).getHours();
    hours[h].tracks.push(item.track);
  });

  // Score each hour
  hours.forEach(h => {
    if (!h.tracks.length) { h.score = null; return; }
    const avgPop = h.tracks.reduce((s, t) => s + (t.popularity || 50), 0) / h.tracks.length;
    const explicit = h.tracks.filter(t => t.explicit).length / h.tracks.length;
    h.score = Math.round(Math.min(100, avgPop * 0.7 + (1 - explicit) * 30));
  });

  const active = hours.filter(h => h.score !== null);
  if (countEl) countEl.textContent = active.length + ' saatte ' + recent.length + ' dinleme';

  // Bar chart - 24 saatlik
  const barW = 100 / 24;
  const maxScore = Math.max(...active.map(h => h.score));

  let bars = '';
  hours.forEach(h => {
    const hasData = h.score !== null;
    const heightPct = hasData ? (h.score / 100) * 100 : 0;
    const color = !hasData ? 'var(--surface3)' :
      h.score > 70 ? '#1DB954' :
      h.score > 40 ? '#ffd93d' : '#ff6b6b';
    const label = h.hour % 3 === 0 ? String(h.hour).padStart(2,'0') + ':00' : '';
    const title = hasData ? `${String(h.hour).padStart(2,'0')}:00 - ${h.tracks.length} sarki, skor: ${h.score}` : `${String(h.hour).padStart(2,'0')}:00 - veri yok`;

    bars += `<div title="${title}" style="
      position:absolute;
      left:${h.hour * (100/24)}%;
      width:calc(${100/24}% - 2px);
      bottom:20px;
      height:calc(${heightPct}% - 0px);
      background:${color};
      border-radius:3px 3px 0 0;
      opacity:${hasData ? 0.9 : 0.2};
      transition:opacity 0.2s;
      cursor:${hasData ? 'pointer' : 'default'};
    " onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity='${hasData ? 0.9 : 0.2}'"></div>`;

    if (label) {
      bars += `<div style="position:absolute;left:${h.hour*(100/24)}%;bottom:4px;font-size:9px;color:rgba(255,255,255,0.3);width:30px">${label}</div>`;
    }
  });

  wrap.innerHTML = `
    <div style="position:relative;width:100%;height:160px;margin-top:0.5rem">
      ${bars}
      <div style="position:absolute;bottom:20px;left:0;right:0;height:1px;background:rgba(255,255,255,0.06)"></div>
    </div>`;

  // Best/worst hour
  if (!active.length) return;
  const best = active.reduce((a, b) => a.score > b.score ? a : b);
  const worst = active.reduce((a, b) => a.score < b.score ? a : b);

  const fmtHour = h => String(h).padStart(2,'0') + ':00';
  document.getElementById('tl-best').innerHTML = `
    <div style="font-size:0.72rem;color:var(--green);font-family:'Syne',sans-serif;font-weight:700;margin-bottom:0.3rem"> EN AKTIF SAAT</div>
    <div style="font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:800">${fmtHour(best.hour)}</div>
    <div style="font-size:0.8rem;color:var(--muted)">${best.tracks.length} sarki - skor ${best.score}</div>`;

  document.getElementById('tl-worst').innerHTML = `
    <div style="font-size:0.72rem;color:var(--accent);font-family:'Syne',sans-serif;font-weight:700;margin-bottom:0.3rem">🌙 EN SAKIN SAAT</div>
    <div style="font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:800">${fmtHour(worst.hour)}</div>
    <div style="font-size:0.8rem;color:var(--muted)">${worst.tracks.length} sarki - skor ${worst.score}</div>`;
}

// ══════════════════════════════════════════════════════
//  SHUFFLED PLAYLIST
// ══════════════════════════════════════════════════════
let currentPlaylist = [];

function initPlaylist(tracks, artists) {
  if (tracks) {
    const data = cachedData[currentTimeRange];
    if (data) shufflePlaylist(data.tracks, data.artists);
  }
}

async function shufflePlaylist(tracksArg, artistsArg) {
  const data = cachedData[currentTimeRange];
  if (!data) return;
  const tracks = tracksArg || data.tracks;
  const artists = artistsArg || data.artists;

  const trackEl = document.getElementById('playlist-tracks');
  const claudeEl = document.getElementById('playlist-claude');
  const nameEl = document.getElementById('playlist-name');

  if (trackEl) trackEl.innerHTML = '<div class="loading"><div class="spinner"></div><span>Benzer sarkiler araniyor...</span></div>';
  if (nameEl) nameEl.textContent = '...';
  if (claudeEl) claudeEl.innerHTML = '<div class="loading"><div class="spinner"></div><span>Claude yorumluyor...</span></div>';

  // Pick 5 random seed tracks from top tracks
  const pool = [...tracks];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const seeds = pool.slice(0, 5).map(t => t.id).join(',');

  // Fetch recommendations
  const recData = await api(`/recommendations?seed_tracks=${seeds}&limit=20`);
  if (!recData || !recData.tracks || !recData.tracks.length) {
    if (trackEl) trackEl.innerHTML = '<div style="color:var(--muted);padding:1rem">Oneri alinamadi, tekrar dene.</div>';
    return;
  }

  currentPlaylist = recData.tracks;

  if (trackEl) {
    trackEl.innerHTML = currentPlaylist.map((t, i) => trackHTML(t, i)).join('');
  }

  await generatePlaylistName(currentPlaylist, artists);
}

function openAllTracks() {
  if (!currentPlaylist.length) return;
  // Open first track, rest can be queued
  const url = currentPlaylist[0]?.external_urls?.spotify;
  if (url) window.open(url, '_blank');
}

async function generatePlaylistName(tracks, artists) {
  const nameEl = document.getElementById('playlist-name');
  const claudeEl = document.getElementById('playlist-claude');
  if (!claudeEl) return;

  claudeEl.innerHTML = '<div class="loading"><div class="spinner"></div><span>Claude yorumluyor...</span></div>';
  if (nameEl) nameEl.textContent = '...';

  const trackList = tracks.slice(0, 10).map(t =>
    `"${t.name}" - ${t.artists[0]?.name}`
  ).join(', ');

  const genreList = [...new Set((artists || []).flatMap(a => a.genres || []))].slice(0, 5).join(', ');

  const prompt = `Bu playlist icin yaratici bir isim ve kisa bir yorum yaz.

Sarkilar: ${trackList}
Turler: ${genreList}

JSON formatinda don, baska hicbir sey yazma:
{
  "name": "(2-4 kelime yaratici playlist adi, Turkce veya Ingilizce olabilir)",
  "emoji": "(tek emoji)",
  "vibe": "(tek cumle: bu playlistin genel havasi)",
  "yorum": "(2-3 cumle: bu sarki seciminin hikayesi ve dinleyiciye ne hissettirec)"
}`;

  try {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(JSON.stringify(data.error));
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON yok');
    const r = JSON.parse(match[0]);

    if (nameEl) nameEl.textContent = r.emoji + ' ' + r.name;

    claudeEl.innerHTML = `
      <div style="margin-bottom:1rem;padding:1rem;background:var(--surface2);border-radius:12px;border-left:3px solid var(--green)">
        <div style="font-size:0.75rem;color:var(--green);font-family:'Syne',sans-serif;font-weight:700;margin-bottom:0.3rem">VIBE</div>
        <div style="font-size:0.9rem;font-style:italic;color:#ddd">${r.vibe}</div>
      </div>
      <div style="font-size:0.9rem;line-height:1.7;color:#ccc">${r.yorum}</div>
      <div style="margin-top:1.5rem;font-size:0.75rem;color:var(--muted)">
        ${currentPlaylist.length} sarki - 
        ${Math.round(currentPlaylist.reduce((s,t) => s + t.duration_ms, 0) / 60000)} dakika
      </div>`;
  } catch(err) {
    claudeEl.innerHTML = `<div class="sentiment-error">Yorum yapilamadi: ${err.message}</div>`;
    if (nameEl) nameEl.textContent = 'Shuffled Mix';
  }
}

