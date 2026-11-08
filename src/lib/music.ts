import forge from 'node-forge';

export interface SearchTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  image: string;
  audioUrl: string;
  source: 'hitmo' | 'saavn' | 'audius';
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
  } catch (err) {
    console.error('DES decryption error:', err);
    return null;
  }
}

// Clean HTML entities from titles like &quot;, &#039;, etc.
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

export async function searchTracks(query: string): Promise<SearchTrack[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const results: SearchTrack[] = [];
  const seenTracks = new Set<string>();

  // 1. Primary Source for Russian & CIS & Global Hits: Hitmo (Full MP3s, accurate title/artist search)
  try {
    const hitmoRes = await fetch(
      `https://rus.hitmotop.com/search?q=${encodeURIComponent(cleanQuery)}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        cache: 'no-store',
      }
    );

    if (hitmoRes.ok) {
      const html = await hitmoRes.text();
      const metaRegex = /data-musmeta='([^']+)'/g;
      let m;
      let count = 0;
      while ((m = metaRegex.exec(html)) !== null && count < 25) {
        try {
          const item = JSON.parse(m[1]);
          if (item.url && item.title) {
            const trackTitle = decodeHtmlEntities(item.title);
            const trackArtist = decodeHtmlEntities(item.artist || 'Неизвестный исполнитель');
            const key = `${trackTitle.toLowerCase()}_${trackArtist.toLowerCase()}`;

            if (!seenTracks.has(key)) {
              seenTracks.add(key);
              results.push({
                id: `hitmo_${item.id || count}_${Date.now()}_${count}`,
                title: trackTitle,
                artist: trackArtist,
                album: 'Single',
                duration: 0,
                image: item.img || '',
                audioUrl: item.url,
                source: 'hitmo',
              });
              count++;
            }
          }
        } catch {
          // ignore corrupted JSON items
        }
      }
    }
  } catch (err) {
    console.error('Hitmo search error:', err);
  }

  // 2. Secondary Source: International Catalog (JioSaavn 320kbps streams)
  try {
    const res = await fetch(
      `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&q=${encodeURIComponent(cleanQuery)}&p=1&n=15`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.results)) {
        for (const item of data.results) {
          if (!item.encrypted_media_url) continue;
          let directUrl = decryptDES(item.encrypted_media_url);
          if (directUrl) {
            directUrl = directUrl.replace(/_96\.mp4$/, '_320.mp4').replace(/_160\.mp4$/, '_320.mp4');

            let artwork = item.image || '';
            if (artwork) {
              artwork = artwork.replace(/50x50\.jpg$/, '500x500.jpg').replace(/150x150\.jpg$/, '500x500.jpg');
            }

            const trackTitle = decodeHtmlEntities(item.song || item.title || 'Unknown Title');
            const trackArtist = decodeHtmlEntities(item.primary_artists || item.singers || 'Unknown Artist');
            const key = `${trackTitle.toLowerCase()}_${trackArtist.toLowerCase()}`;

            if (!seenTracks.has(key)) {
              seenTracks.add(key);
              results.push({
                id: `saavn_${item.id}`,
                title: trackTitle,
                artist: trackArtist,
                album: decodeHtmlEntities(item.album || ''),
                duration: parseInt(item.duration, 10) || 0,
                image: artwork,
                audioUrl: directUrl,
                source: 'saavn',
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Saavn search error:', err);
  }

  // 3. Fallback: Audius for indie & remix searches
  if (results.length < 5) {
    try {
      const res = await fetch(
        `https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(cleanQuery)}&app_name=iOSMusicApp`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.data)) {
          for (const item of data.data.slice(0, 10)) {
            const artwork =
              item.artwork?.['480x480'] ||
              item.artwork?.['150x150'] ||
              item.artwork?.['1000x1000'] ||
              '';
            const audioUrl = `https://api.audius.co/v1/tracks/${item.id}/stream?app_name=iOSMusicApp`;

            const key = `${item.title.toLowerCase()}_${(item.user?.name || '').toLowerCase()}`;
            if (!seenTracks.has(key)) {
              seenTracks.add(key);
              results.push({
                id: `audius_${item.id}`,
                title: item.title,
                artist: item.user?.name || 'Unknown Artist',
                album: item.genre || '',
                duration: item.duration || 0,
                image: artwork,
                audioUrl: audioUrl,
                source: 'audius',
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('Audius search error:', e);
    }
  }

  return results;
}
