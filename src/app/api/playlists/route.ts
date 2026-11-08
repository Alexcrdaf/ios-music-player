import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb, saveDb, Playlist } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const db = await getDb();
    let userPlaylists = db.playlists.filter((p) => p.userId === session.userId);

    // If user has no playlists yet, create default one
    if (userPlaylists.length === 0) {
      const defaultPlaylist: Playlist = {
        id: 'pl_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
        userId: session.userId,
        name: 'Любимые треки',
        createdAt: new Date().toISOString(),
        tracks: [],
      };
      db.playlists.push(defaultPlaylist);
      await saveDb(db);
      userPlaylists = [defaultPlaylist];
    }

    return NextResponse.json({ playlists: userPlaylists });
  } catch (err) {
    console.error('Playlists GET error:', err);
    return NextResponse.json({ error: 'Ошибка получения плейлистов' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { name } = await req.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Имя плейлиста обязательно' }, { status: 400 });
    }

    const db = await getDb();
    const newPlaylist: Playlist = {
      id: 'pl_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
      userId: session.userId,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      tracks: [],
    };

    db.playlists.push(newPlaylist);
    await saveDb(db);

    return NextResponse.json({ success: true, playlist: newPlaylist });
  } catch (err) {
    console.error('Playlists POST error:', err);
    return NextResponse.json({ error: 'Ошибка создания плейлиста' }, { status: 500 });
  }
}
