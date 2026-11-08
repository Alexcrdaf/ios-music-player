import fs from 'fs';
import path from 'path';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  image: string;
  audioUrl: string;
}

export interface Playlist {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  tracks: Track[];
}

export interface DatabaseSchema {
  users: User[];
  playlists: Playlist[];
}

const LOCAL_DB_PATH = path.join(process.cwd(), '.data', 'db.json');

const GIST_TOKEN = process.env.GITHUB_DB_TOKEN;
const GIST_ID = process.env.GITHUB_DB_GIST_ID;

// Fallback in-memory/file storage if cloud gist is not yet configured
function getLocalDb(): DatabaseSchema {
  try {
    if (!fs.existsSync(path.dirname(LOCAL_DB_PATH))) {
      fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
    }
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const data = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading local db:', err);
  }
  return { users: [], playlists: [] };
}

function saveLocalDb(data: DatabaseSchema) {
  try {
    if (!fs.existsSync(path.dirname(LOCAL_DB_PATH))) {
      fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
    }
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving local db:', err);
  }
}

export async function getDb(): Promise<DatabaseSchema> {
  if (GIST_TOKEN && GIST_ID) {
    try {
      const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        headers: {
          Authorization: `Bearer ${GIST_TOKEN}`,
          'User-Agent': 'IOSMusicApp',
          Accept: 'application/vnd.github+json',
        },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.files?.['data.json']?.content;
        if (content) {
          const parsed = JSON.parse(content);
          return {
            users: parsed.users || [],
            playlists: parsed.playlists || [],
          };
        }
      } else {
        console.warn('Failed to fetch Gist db, falling back to local:', res.status);
      }
    } catch (e) {
      console.error('Gist fetch error:', e);
    }
  }
  return getLocalDb();
}

export async function saveDb(data: DatabaseSchema): Promise<void> {
  saveLocalDb(data);

  if (GIST_TOKEN && GIST_ID) {
    try {
      const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${GIST_TOKEN}`,
          'User-Agent': 'IOSMusicApp',
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify({
          files: {
            'data.json': {
              content: JSON.stringify(data, null, 2),
            },
          },
        }),
      });
      if (!res.ok) {
        console.error('Failed to update Gist DB:', res.status, await res.text());
      }
    } catch (e) {
      console.error('Gist update error:', e);
    }
  }
}
