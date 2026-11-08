import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb, saveDb, User } from '@/lib/db';
import { signToken, COOKIE_NAME } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Логин и пароль обязательны' }, { status: 400 });
    }

    const cleanUsername = String(username).trim();
    if (cleanUsername.length < 2) {
      return NextResponse.json({ error: 'Логин слишком короткий' }, { status: 400 });
    }

    const db = await getDb();
    const existing = db.users.find(
      (u) => u.username.toLowerCase() === cleanUsername.toLowerCase()
    );

    if (existing) {
      return NextResponse.json({ error: 'Пользователь с таким логином уже существует' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser: User = {
      id: 'usr_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
      username: cleanUsername,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    // Automatically create a default playlist for user
    const defaultPlaylist = {
      id: 'pl_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
      userId: newUser.id,
      name: 'Любимые треки',
      createdAt: new Date().toISOString(),
      tracks: [],
    };

    db.users.push(newUser);
    db.playlists.push(defaultPlaylist);
    await saveDb(db);

    const token = signToken({ userId: newUser.id, username: newUser.username });
    const response = NextResponse.json({
      success: true,
      user: { id: newUser.id, username: newUser.username },
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    return response;
  } catch (err) {
    console.error('Register error:', err);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
