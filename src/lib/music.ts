import forge from 'node-forge';

export interface SearchTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  image: string;
  audioUrl: string;
  source: 'ym' | 'muzofond' | 'hitmo' | 'saavn' | 'audius';
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

export async function searchTracks(query: string): Promise<SearchTrack[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const results: SearchTrack[] = [];
  const seenKeys = new Set<string>();

  // 1. Primary Source: Yandex Music Catalog (Finds "Свидетельство о смерти", "Burial - Forgive", Russian & Global discographies)
  try {
    const ymRes = await fetch(
      `https://api.music.yandex.net/search?text=${encodeURIComponent(cleanQuery)}&type=all&page=0`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)',
          Accept: 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (ymRes.ok) {
      const ymData = await ymRes.json();
      const tracks = ymData.result?.tracks?.results || [];
      for (const t of tracks.slice(0, 20)) {
        const title = decodeHtmlEntities(t.title || 'Unknown Title');
        const artist = decodeHtmlEntities(t.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist');
        const key = `${title.toLowerCase()}_${artist.toLowerCase()}`;

        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const artwork = t.coverUri
            ? `https://${t.coverUri.replace('%%', '400x400')}`
            : '';

          results.push({
            id: `ym_${t.id}`,
            title,
            artist,
            album: t.albums?.[0]?.title || '',
            duration: Math.round((t.durationMs || 0) / 1000),
            image: artwork,
            audioUrl: `/api/stream?source=ym&id=${t.id}`,
            source: 'ym',
          });
        }
      }
    }
  } catch (err) {
    console.error('YM search error:', err);
  }

  // 2. Secondary Source: Muzofond (Finds rare underground tracks, "Свидетельство о смерти", indie bootlegs)
  try {
    const muzoRes = await fetch(`https://muzofond.fm/search/${encodeURIComponent(cleanQuery)}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
      },
      cache: 'no-store',
    });

    if (muzoRes.ok) {
      const html = await muzoRes.text();
      const trackRegex =
        /<li[^>]+class="item"[^>]*data-id="([^"]+)"[\s\S]*?data-url="(https:\/\/[^"]*muzofond\.fm\/[^"]+)"[\s\S]*?<span[^>]+class="artist">([\s\S]*?)<\/span>[\s\S]*?<a[^>]+data-trackLink[^>]*>([\s\S]*?)<\/a>/g;
      let m;
      let count = 0;
      while ((m = trackRegex.exec(html)) !== null && count < 20) {
        const streamUrl = m[2];
        const artist = decodeHtmlEntities(m[3].replace(/<[^>]+>/g, '').trim());
        const title = decodeHtmlEntities(m[4].replace(/<[^>]+>/g, '').trim());
        const key = `${title.toLowerCase()}_${artist.toLowerCase()}`;

        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          results.push({
            id: `muzofond_${m[1]}_${count}`,
            title,
            artist,
            album: 'Single',
            duration: 0,
            image: '',
            audioUrl: `/api/stream?url=${encodeURIComponent(streamUrl)}`,
            source: 'muzofond',
          });
          count++;
        }
      }
    }
  } catch (err) {
    console.error('Muzofond search error:', err);
  }

  // 3. Third Source: Hitmo (for hits, rap, and CIS pop)
  try {
    const hitmoRes = await fetch(
      `https://rus.hitmotop.com/search?q=${encodeURIComponent(cleanQuery)}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        cache: 'no-store',
      }
    );

    if (hitmoRes.ok) {
      const html = await hitmoRes.text();
      const metaRegex = /data-musmeta='([^']+)'/g;
      let m;
      let count = 0;
      while ((m = metaRegex.exec(html)) !== null && count < 15) {
        try {
          const item = JSON.parse(m[1]);
          if (item.url && item.title) {
            const trackTitle = decodeHtmlEntities(item.title);
            const trackArtist = decodeHtmlEntities(item.artist || 'Неизвестный исполнитель');
            const key = `${trackTitle.toLowerCase()}_${trackArtist.toLowerCase()}`;

            let rawUrl: string = item.url;
            if (rawUrl.startsWith('/')) {
              rawUrl = `https://rus.hitmotop.com${rawUrl}`;
            }

            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              results.push({
                id: `hitmo_${item.id || count}_${count}`,
                title: trackTitle,
                artist: trackArtist,
                album: 'Single',
                duration: 0,
                image: item.img || '',
                audioUrl: `/api/stream?url=${encodeURIComponent(rawUrl)}`,
                source: 'hitmo',
              });
              count++;
            }
          }
        } catch {}
      }
    }
  } catch (err) {
    console.error('Hitmo search error:', err);
  }

  // 4. Fourth Source: International Catalog (JioSaavn 320kbps streams)
  try {
    const res = await fetch(
      `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&q=${encodeURIComponent(cleanQuery)}&p=1&n=15`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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

            if (!seenKeys.has(key)) {
              seenKeys.add(key);
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

  return results;
}
