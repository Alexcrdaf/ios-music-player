import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb, saveDb, Track } from '@/lib/db';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { id } = await params;
    const track: Track = await req.json();

    if (!track || !track.id || !track.title || !track.audioUrl) {
      return NextResponse.json({ error: 'Неверные данные трека' }, { status: 400 });
    }

    const db = await getDb();
    const playlist = db.playlists.find((p) => p.id === id && p.userId === session.userId);

    if (!playlist) {
      return NextResponse.json({ error: 'Плейлист не найден' }, { status: 404 });
    }

    // Check if track is already in playlist
    const existingIndex = playlist.tracks.findIndex((t) => t.id === track.id);
    if (existingIndex === -1) {
      playlist.tracks.push(track);
    }

    await saveDb(db);
    return NextResponse.json({ success: true, playlist });
  } catch (err) {
    console.error('Playlist add track error:', err);
    return NextResponse.json({ error: 'Ошибка добавления трека' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const trackId = searchParams.get('trackId');

    const db = await getDb();
    const playlistIndex = db.playlists.findIndex((p) => p.id === id && p.userId === session.userId);

    if (playlistIndex === -1) {
      return NextResponse.json({ error: 'Плейлист не найден' }, { status: 404 });
    }

    if (trackId) {
      // Remove specific track
      db.playlists[playlistIndex].tracks = db.playlists[playlistIndex].tracks.filter(
        (t) => t.id !== trackId
      );
    } else {
      // Delete whole playlist
      db.playlists.splice(playlistIndex, 1);
    }

    await saveDb(db);
    return NextResponse.json({ success: true, playlist: db.playlists[playlistIndex] });
  } catch (err) {
    console.error('Playlist delete error:', err);
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 });
  }
}
