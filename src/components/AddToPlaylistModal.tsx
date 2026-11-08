'use client';

import React, { useState } from 'react';
import { Track } from '@/context/PlayerContext';
import { Plus, Check, FolderPlus } from 'lucide-react';

interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
}

export function AddToPlaylistModal({
  isOpen,
  onClose,
  track,
  playlists,
  onTrackAdded,
  onCreatePlaylist,
}: {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
  playlists: Playlist[];
  onTrackAdded: (playlistId: string, track: Track) => Promise<void>;
  onCreatePlaylist: (name: string) => Promise<Playlist | null>;
}) {
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creating, setCreating] = useState(false);
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});

  if (!isOpen || !track) return null;

  const handleAdd = async (playlistId: string) => {
    await onTrackAdded(playlistId, track);
    setAddedIds((prev) => ({ ...prev, [playlistId]: true }));
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    setCreating(true);
    const newPl = await onCreatePlaylist(newPlaylistName.trim());
    if (newPl) {
      await onTrackAdded(newPl.id, track);
      setAddedIds((prev) => ({ ...prev, [newPl.id]: true }));
      setNewPlaylistName('');
      setTimeout(() => {
        onClose();
      }, 600);
    }
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white text-sm px-2 py-1"
        >
          ✕
        </button>

        <h3 className="text-lg font-bold text-white mb-1">Добавить в плейлист</h3>
        <p className="text-xs text-zinc-400 truncate mb-4">
          «{track.title}» — {track.artist}
        </p>

        {/* Existing Playlists */}
        <div className="max-h-52 overflow-y-auto space-y-2 mb-4 pr-1">
          {playlists.map((pl) => {
            const isAdded =
              addedIds[pl.id] || pl.tracks.some((t) => t.id === track.id);
            return (
              <button
                key={pl.id}
                onClick={() => handleAdd(pl.id)}
                disabled={isAdded}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 transition text-left"
              >
                <div>
                  <p className="text-sm font-medium text-white">{pl.name}</p>
                  <p className="text-xs text-zinc-500">{pl.tracks.length} треков</p>
                </div>
                {isAdded ? (
                  <Check className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Plus className="w-5 h-5 text-zinc-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* Create new playlist input */}
        <form onSubmit={handleCreateAndAdd} className="flex gap-2">
          <input
            type="text"
            placeholder="Новый плейлист..."
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            className="flex-1 bg-zinc-800/80 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500"
          />
          <button
            type="submit"
            disabled={creating || !newPlaylistName.trim()}
            className="px-3 py-2 rounded-xl bg-rose-500 text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-40 flex items-center gap-1"
          >
            <FolderPlus className="w-4 h-4" />
            Создать
          </button>
        </form>
      </div>
    </div>
  );
}
