import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

async function getYandexMusicDirectUrl(trackId: string): Promise<string | null> {
  try {
    const infoRes = await fetch(`https://api.music.yandex.net/tracks/${trackId}/download-info`, {
      cache: 'no-store',
    });
    if (!infoRes.ok) return null;
    const infoData = await infoRes.json();
    const info = infoData.result?.[0];
    if (!info || !info.downloadInfoUrl) return null;

    const xmlRes = await fetch(info.downloadInfoUrl, { cache: 'no-store' });
    const xml = await xmlRes.text();

    const hostMatch = xml.match(/<host>([^<]+)<\/host>/);
    const pathMatch = xml.match(/<path>([^<]+)<\/path>/);
    const tsMatch = xml.match(/<ts>([^<]+)<\/ts>/);
    const sMatch = xml.match(/<s>([^<]+)<\/s>/);

    if (!hostMatch || !pathMatch || !tsMatch || !sMatch) return null;

    const host = hostMatch[1];
    const path = pathMatch[1];
    const ts = tsMatch[1];
    const s = sMatch[1];

    const salt = 'XGRlBW9FXlekgbPrRHuSiA';
    const sign = crypto.createHash('md5').update(salt + path.slice(1) + s).digest('hex');
    return `https://${host}/get-mp3/${sign}/${ts}${path}`;
  } catch (err) {
    console.error('Yandex stream resolve error:', err);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get('source');
  const targetUrl = searchParams.get('url');
  const trackId = searchParams.get('id');

  let resolvedStreamUrl: string | null = targetUrl;

  if (source === 'ym' && trackId) {
    resolvedStreamUrl = await getYandexMusicDirectUrl(trackId);
  }

  if (!resolvedStreamUrl) {
    return new NextResponse('Stream URL not found or could not be resolved', { status: 404 });
  }

  try {
    const rangeHeader = req.headers.get('range');
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      Referer: resolvedStreamUrl.includes('muzofond') ? 'https://muzofond.fm/' : 'https://music.yandex.ru/',
      Accept: '*/*',
    };

    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const audioRes = await fetch(resolvedStreamUrl, {
      headers,
      redirect: 'follow',
    });

    if (!audioRes.ok && audioRes.status !== 206) {
      return new NextResponse(`Remote audio stream error: ${audioRes.status}`, {
        status: audioRes.status,
      });
    }

    const responseHeaders = new Headers();
    const contentType = audioRes.headers.get('content-type') || 'audio/mpeg';
    responseHeaders.set('Content-Type', contentType);
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Cache-Control', 'public, max-age=86400');

    const contentLength = audioRes.headers.get('content-length');
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }

    const contentRange = audioRes.headers.get('content-range');
    if (contentRange) {
      responseHeaders.set('Content-Range', contentRange);
    }

    return new NextResponse(audioRes.body as any, {
      status: audioRes.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error('Audio stream proxy error:', err);
    return new NextResponse('Internal audio proxy error', { status: 500 });
  }
}
