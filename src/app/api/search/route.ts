import { NextResponse, NextRequest } from 'next/server';
import { searchTracks } from '@/lib/music';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ results: [] });
    }

    const results = await searchTracks(query);
    return NextResponse.json({ results });
  } catch (err) {
    console.error('Search API error:', err);
    return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
  }
}
