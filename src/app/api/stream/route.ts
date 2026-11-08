import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const rangeHeader = req.headers.get('range');
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      Referer: 'https://rus.hitmotop.com/',
      Accept: '*/*',
    };

    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const audioRes = await fetch(targetUrl, {
      headers,
      redirect: 'follow',
    });

    if (!audioRes.ok && audioRes.status !== 206) {
      return new NextResponse(`Remote audio error: ${audioRes.status}`, {
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
