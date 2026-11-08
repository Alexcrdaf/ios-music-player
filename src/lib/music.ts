import forge from 'node-forge';

export interface SearchTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  image: string;
  audioUrl: string;
  source: 'ym' | 'muzofond' | 'hitmo' | 'saavn';
}

function decryptDES(encrypted: string): string | null {
  try {
    const key = '38346591';
    const encryptedBytes = forge.util.decode64(encrypted);
    const decipher = forge.cipher.createDecipher('DES-ECB', forge.util.createBuffer(key));
    decipher.start({ iv: '' });
    decipher.update(forge.util.createBuffer(encryptedBytes));
    decipher.finish();
    return decipher.output.toString();
  } catch {
    return null;
  }
}

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ');
}

// Fast fetch with guaranteed timeout so Vercel serverless function never times out (502 / 504)
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 3500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// 1. Yandex Music Search (Accurate discographies, full albums, indie & rock)
async function searchYandex(query: string): Promise<SearchTrack[]> {
  try {
    const res = await fetchWithTimeout(
      `https://api.music.yandex.net/search?text=${encodeURIComponent(query)}&type=all&page=0`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
          Accept: 'application/json',
        },
      },
      3000
    );

    if (!res.ok) return [];
    const data = await res.json();
    const tracks = data.result?.tracks?.results || [];
    return tracks.slice(0, 20).map((t: any) => ({
      id: `ym_${t.id}`,
      title: decodeHtmlEntities(t.title || 'Unknown Title'),
      artist: decodeHtmlEntities(t.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist'),
      album: t.albums?.[0]?.title || '',
      duration: Math.round((t.durationMs || 0) / 1000),
      image: t.coverUri ? `https://${t.coverUri.replace('%%', '400x400')}` : '',
      audioUrl: `/api/stream?source=ym&id=${t.id}`,
      source: 'ym' as const,
    }));
  } catch {
    return [];
  }
}

// 2. Muzofond Search (Rare songs, alternative archives)
async function searchMuzofond(query: string): Promise<SearchTrack[]> {
  try {
    const res = await fetchWithTimeout(
      `https://muzofond.fm/search/${encodeURIComponent(query)}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
        },
      },
      3000
    );

    if (!res.ok) return [];
    const html = await res.text();
    const trackRegex =
      /<li[^>]+class="item"[^>]*data-id="([^"]+)"[\s\S]*?data-url="(https:\/\/[^"]*muzofond\.fm\/[^"]+)"[\s\S]*?<span[^>]+class="artist">([\s\S]*?)<\/span>[\s\S]*?<a[^>]+data-trackLink[^>]*>([\s\S]*?)<\/a>/g;

    const list: SearchTrack[] = [];
    let m;
    let count = 0;
    while ((m = trackRegex.exec(html)) !== null && count < 15) {
      const streamUrl = m[2];
      const artist = decodeHtmlEntities(m[3].replace(/<[^>]+>/g, '').trim());
      const title = decodeHtmlEntities(m[4].replace(/<[^>]+>/g, '').trim());
      list.push({
        id: `muzofond_${m[1]}_${count}`,
        title,
        artist,
        album: 'Single',
        duration: 0,
        image: '',
        audioUrl: `/api/stream?url=${encodeURIComponent(streamUrl)}`,
        source: 'muzofond' as const,
      });
      count++;
    }
    return list;
  } catch {
    return [];
  }
}

// 3. Hitmo Search
async function searchHitmo(query: string): Promise<SearchTrack[]> {
  try {
    const res = await fetchWithTimeout(
      `https://rus.hitmotop.com/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
      },
      3000
    );

    if (!res.ok) return [];
    const html = await res.text();
    const metaRegex = /data-musmeta='([^']+)'/g;
    const list: SearchTrack[] = [];
    let m;
    let count = 0;
    while ((m = metaRegex.exec(html)) !== null && count < 15) {
      try {
        const item = JSON.parse(m[1]);
        if (item.url && item.title) {
          let rawUrl: string = item.url;
          if (rawUrl.startsWith('/')) {
            rawUrl = `https://rus.hitmotop.com${rawUrl}`;
          }
          list.push({
            id: `hitmo_${item.id || count}_${count}`,
            title: decodeHtmlEntities(item.title),
            artist: decodeHtmlEntities(item.artist || 'Неизвестный исполнитель'),
            album: 'Single',
            duration: 0,
            image: item.img || '',
            audioUrl: `/api/stream?url=${encodeURIComponent(rawUrl)}`,
            source: 'hitmo' as const,
          });
          count++;
        }
      } catch {}
    }
    return list;
  } catch {
    return [];
  }
}

// 4. JioSaavn Search (International 320kbps catalog)
async function searchSaavn(query: string): Promise<SearchTrack[]> {
  try {
    const res = await fetchWithTimeout(
      `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&q=${encodeURIComponent(query)}&p=1&n=10`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
      },
      3000
    );

    if (!res.ok) return [];
    const data = await res.json();
    if (!data || !Array.isArray(data.results)) return [];

    const list: SearchTrack[] = [];
    for (const item of data.results) {
      if (!item.encrypted_media_url) continue;
      let directUrl = decryptDES(item.encrypted_media_url);
      if (directUrl) {
        directUrl = directUrl.replace(/_96\.mp4$/, '_320.mp4').replace(/_160\.mp4$/, '_320.mp4');
        let artwork = item.image || '';
        if (artwork) {
          artwork = artwork.replace(/50x50\.jpg$/, '500x500.jpg').replace(/150x150\.jpg$/, '500x500.jpg');
        }
        list.push({
          id: `saavn_${item.id}`,
          title: decodeHtmlEntities(item.song || item.title || 'Unknown Title'),
          artist: decodeHtmlEntities(item.primary_artists || item.singers || 'Unknown Artist'),
          album: decodeHtmlEntities(item.album || ''),
          duration: parseInt(item.duration, 10) || 0,
          image: artwork,
          audioUrl: directUrl,
          source: 'saavn' as const,
        });
      }
    }
    return list;
  } catch {
    return [];
  }
}

export async function searchTracks(query: string): Promise<SearchTrack[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  // Execute searches in PARALLEL so response time is under ~1.5 - 2 seconds max
  const [ymResults, muzofondResults, hitmoResults, saavnResults] = await Promise.all([
    searchYandex(cleanQuery),
    searchMuzofond(cleanQuery),
    searchHitmo(cleanQuery),
    searchSaavn(cleanQuery),
  ]);

  const combined = [...ymResults, ...muzofondResults, ...hitmoResults, ...saavnResults];
  const uniqueList: SearchTrack[] = [];
  const seenKeys = new Set<string>();

  for (const track of combined) {
    const key = `${track.title.toLowerCase()}_${track.artist.toLowerCase()}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueList.push(track);
    }
  }

  return uniqueList;
}
