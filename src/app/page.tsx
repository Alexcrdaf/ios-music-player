'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePlayer, Track } from '@/context/PlayerContext';
import { MiniPlayer, FullPlayer } from '@/components/Player';
import { AuthModal } from '@/components/AuthModal';
import { AddToPlaylistModal } from '@/components/AddToPlaylistModal';
import {
  Search,
  Library,
  Compass,
  Play,
  Plus,
  Trash2,
  User,
  LogOut,
  Music,
  Heart,
  ListMusic,
  Share2,
} from 'lucide-react';

interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
}

export default function Home() {
  const { user, loading: authLoading, logout } = useAuth();
  const { currentTrack, playTrack } = usePlayer();

  const [activeTab, setActiveTab] = useState<'search' | 'library'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [targetTrackForPlaylist, setTargetTrackForPlaylist] = useState<Track | null>(null);

  // Fetch playlists when authenticated
  const loadPlaylists = async () => {
    if (!user) {
      setPlaylists([]);
      setSelectedPlaylist(null);
      return;
    }
    try {
      const res = await fetch('/api/playlists');
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data.playlists || []);
        if (data.playlists?.length > 0 && !selectedPlaylist) {
          setSelectedPlaylist(data.playlists[0]);
        }
      }
    } catch (e) {
      console.error('Error fetching playlists:', e);
    }
  };

  useEffect(() => {
    loadPlaylists();
  }, [user]);

  // Handle Search
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  // Add Track to Playlist
  const handleAddTrack = async (playlistId: string, track: Track) => {
    try {
      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(track),
      });
      if (res.ok) {
        await loadPlaylists();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Remove Track from Playlist
  const handleRemoveTrack = async (playlistId: string, trackId: string) => {
    try {
      const res = await fetch(`/api/playlists/${playlistId}?trackId=${trackId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === playlistId
              ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) }
              : p
          )
        );
        if (selectedPlaylist?.id === playlistId) {
          setSelectedPlaylist((prev) =>
            prev ? { ...prev, tracks: prev.tracks.filter((t) => t.id !== trackId) } : null
          );
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Create Playlist
  const handleCreatePlaylist = async (name: string): Promise<Playlist | null> => {
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        await loadPlaylists();
        return data.playlist;
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  return (
    <div className="flex flex-col min-h-screen bg-black text-white pb-32">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <Music className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Flow Music</span>
        </div>

        <div>
          {authLoading ? (
            <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-300 font-medium px-2 py-1 rounded-full bg-zinc-800">
                {user.username}
              </span>
              <button
                onClick={logout}
                title="Выйти"
                className="p-2 text-zinc-400 hover:text-rose-400 rounded-full bg-zinc-900 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="text-xs font-semibold px-4 py-1.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20 transition active:scale-95"
            >
              Войти
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 pt-4">
        {activeTab === 'search' ? (
          <div>
            {/* Search Input Bar */}
            <form onSubmit={handleSearch} className="mb-6 relative flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-zinc-400" />
              <input
                type="text"
                placeholder="Поиск любых песен, артистов, треков..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-2xl pl-12 pr-24 py-3.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition shadow-inner"
              />
              <button
                type="submit"
                disabled={searching || !searchQuery.trim()}
                className="absolute right-2 px-4 py-2 rounded-xl bg-rose-500 text-xs font-semibold text-white hover:bg-rose-600 transition disabled:opacity-30"
              >
                {searching ? 'Ищем...' : 'Найти'}
              </button>
            </form>

            {/* Quick search suggestions if empty */}
            {searchResults.length === 0 && !searching && (
              <div className="py-10 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-3xl bg-zinc-900 flex items-center justify-center mb-4">
                  <Compass className="w-8 h-8 text-rose-500" />
                </div>
                <h2 className="text-xl font-bold mb-2">Миллионы треков онлайн</h2>
                <p className="text-xs text-zinc-400 max-w-xs mb-6">
                  Ищите любые зарубежные и русские песни, включайте фоновое воспроизведение и блокируйте экран iPhone.
                </p>

                {/* Popular tags */}
                <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                  {['Eminem', 'The Weeknd', 'Queen', 'Miyagi', 'Linkin Park', 'Billie Eilish'].map(
                    (tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          setSearchQuery(tag);
                          setTimeout(() => {
                            fetch(`/api/search?q=${encodeURIComponent(tag)}`)
                              .then((r) => r.json())
                              .then((d) => setSearchResults(d.results || []));
                          }, 50);
                        }}
                        className="px-3.5 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-xs text-zinc-300 transition"
                      >
                        {tag}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Results List */}
            <div className="space-y-2">
              {searchResults.map((track) => {
                const isCurrent = currentTrack?.id === track.id;
                return (
                  <div
                    key={track.id}
                    className={`flex items-center justify-between p-2.5 rounded-2xl transition border ${
                      isCurrent
                        ? 'bg-rose-950/20 border-rose-500/30'
                        : 'bg-zinc-900/40 hover:bg-zinc-900 border-white/5'
                    }`}
                  >
                    <div
                      onClick={() => playTrack(track, searchResults)}
                      className="flex items-center gap-3 overflow-hidden flex-1 cursor-pointer pr-2"
                    >
                      {track.image ? (
                        <img
                          src={track.image}
                          alt={track.title}
                          className="w-12 h-12 rounded-xl object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                          <Music className="w-6 h-6 text-zinc-500" />
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <p
                          className={`font-semibold text-sm truncate ${
                            isCurrent ? 'text-rose-400' : 'text-white'
                          }`}
                        >
                          {track.title}
                        </p>
                        <p className="text-xs text-zinc-400 truncate">{track.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => playTrack(track, searchResults)}
                        className="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white transition active:scale-90"
                      >
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (!user) {
                            setIsAuthModalOpen(true);
                          } else {
                            setTargetTrackForPlaylist(track);
                          }
                        }}
                        title="Добавить в плейлист"
                        className="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300 hover:text-white transition active:scale-90"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Library Tab */
          <div>
            {!user ? (
              <div className="py-16 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-3xl bg-zinc-900 flex items-center justify-center mb-4">
                  <User className="w-8 h-8 text-rose-500" />
                </div>
                <h2 className="text-xl font-bold mb-2">Войдите в аккаунт</h2>
                <p className="text-xs text-zinc-400 max-w-xs mb-6">
                  Создайте аккаунт или войдите, чтобы сохранять плейлисты и слушать их на любом устройстве.
                </p>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-6 py-2.5 rounded-full bg-rose-500 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 active:scale-95 transition"
                >
                  Войти или создать
                </button>
              </div>
            ) : (
              <div>
                {/* Playlists Horizontal Bar */}
                <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-4 scrollbar-none">
                  {playlists.map((pl) => {
                    const isSel = selectedPlaylist?.id === pl.id;
                    return (
                      <button
                        key={pl.id}
                        onClick={() => setSelectedPlaylist(pl)}
                        className={`px-4 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition ${
                          isSel
                            ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                            : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                        }`}
                      >
                        {pl.name} ({pl.tracks.length})
                      </button>
                    );
                  })}
                </div>

                {/* Selected Playlist Content */}
                {selectedPlaylist && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-xl font-bold text-white">{selectedPlaylist.name}</h2>
                        <p className="text-xs text-zinc-400">
                          {selectedPlaylist.tracks.length} треков в плейлисте
                        </p>
                      </div>

                      {selectedPlaylist.tracks.length > 0 && (
                        <button
                          onClick={() =>
                            playTrack(selectedPlaylist.tracks[0], selectedPlaylist.tracks)
                          }
                          className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          Слушать все
                        </button>
                      )}
                    </div>

                    {selectedPlaylist.tracks.length === 0 ? (
                      <div className="py-12 text-center text-zinc-500 text-xs">
                        Плейлист пуст. Найдите песни на вкладке «Поиск» и добавьте их сюда!
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedPlaylist.tracks.map((track) => {
                          const isCurrent = currentTrack?.id === track.id;
                          return (
                            <div
                              key={track.id}
                              className={`flex items-center justify-between p-2.5 rounded-2xl transition border ${
                                isCurrent
                                  ? 'bg-rose-950/20 border-rose-500/30'
                                  : 'bg-zinc-900/40 hover:bg-zinc-900 border-white/5'
                              }`}
                            >
                              <div
                                onClick={() =>
                                  playTrack(track, selectedPlaylist.tracks)
                                }
                                className="flex items-center gap-3 overflow-hidden flex-1 cursor-pointer pr-2"
                              >
                                {track.image ? (
                                  <img
                                    src={track.image}
                                    alt={track.title}
                                    className="w-12 h-12 rounded-xl object-cover shrink-0"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                                    <Music className="w-6 h-6 text-zinc-500" />
                                  </div>
                                )}
                                <div className="overflow-hidden">
                                  <p
                                    className={`font-semibold text-sm truncate ${
                                      isCurrent ? 'text-rose-400' : 'text-white'
                                    }`}
                                  >
                                    {track.title}
                                  </p>
                                  <p className="text-xs text-zinc-400 truncate">
                                    {track.artist}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={() =>
                                    playTrack(track, selectedPlaylist.tracks)
                                  }
                                  className="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white transition active:scale-90"
                                >
                                  <Play className="w-4 h-4 fill-current ml-0.5" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleRemoveTrack(selectedPlaylist.id, track.id)
                                  }
                                  title="Удалить из плейлиста"
                                  className="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-rose-400 transition active:scale-90"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Mini Player widget */}
      <MiniPlayer />

      {/* Full-Screen iOS modal player */}
      <FullPlayer />

      {/* Bottom iOS Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-zinc-950/80 backdrop-blur-2xl border-t border-white/5 py-2.5 px-6 flex items-center justify-around">
        <button
          onClick={() => setActiveTab('search')}
          className={`flex flex-col items-center gap-1 transition ${
            activeTab === 'search' ? 'text-rose-500' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Search className="w-6 h-6" />
          <span className="text-[11px] font-medium">Поиск</span>
        </button>

        <button
          onClick={() => setActiveTab('library')}
          className={`flex flex-col items-center gap-1 transition ${
            activeTab === 'library' ? 'text-rose-500' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Library className="w-6 h-6" />
          <span className="text-[11px] font-medium">Медиатека</span>
        </button>
      </nav>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          loadPlaylists();
        }}
      />

      <AddToPlaylistModal
        isOpen={!!targetTrackForPlaylist}
        onClose={() => setTargetTrackForPlaylist(null)}
        track={targetTrackForPlaylist}
        playlists={playlists}
        onTrackAdded={handleAddTrack}
        onCreatePlaylist={handleCreatePlaylist}
      />
    </div>
  );
}
