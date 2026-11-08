import forge from 'node-forge';

export interface SearchTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  image: string;
  audioUrl: string;
  source: 'saavn' | 'itunes' | 'audius';
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
    .replace(/&mdash;/g, '—');
}

export async function searchTracks(query: string): Promise<SearchTrack[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const results: SearchTrack[] = [];

  // 1. Primary Source: JioSaavn (Full 320kbps / 160kbps songs, universal catalog)
  try {
    const res = await fetch(
      `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&q=${encodeURIComponent(cleanQuery)}&p=1&n=15`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
            // Upgrade from 96kbps / default to high-quality 320kbps
            directUrl = directUrl.replace(/_96\.mp4$/, '_320.mp4').replace(/_160\.mp4$/, '_320.mp4');

            // Upgrade artwork resolution to 500x500
            let artwork = item.image || '';
            if (artwork) {
              artwork = artwork.replace(/50x50\.jpg$/, '500x500.jpg').replace(/150x150\.jpg$/, '500x500.jpg');
            }

            results.push({
              id: `saavn_${item.id}`,
              title: decodeHtmlEntities(item.song || item.title || 'Unknown Title'),
              artist: decodeHtmlEntities(item.primary_artists || item.singers || 'Unknown Artist'),
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
  } catch (err) {
    console.error('Saavn search error:', err);
  }

  // 2. Secondary fallback / addition: Audius (indie & remix catalog)
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
    } catch (e) {
      console.error('Audius search error:', e);
    }
  }

  return results;
}
