'use client';

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  image: string;
  audioUrl: string;
}

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  queue: Track[];
  queueIndex: number;
  currentTime: number;
  duration: number;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  playTrack: (track: Track, newQueue?: Track[]) => void;
  togglePlay: () => void;
  playNext: () => void;
  playPrev: () => void;
  seekTo: (seconds: number) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Audio element and background playback hooks
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    // iOS Safari background audio plays reliably when autoplay/playsinline are handled
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');

    audio.addEventListener('play', () => {
      setIsPlaying(true);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    });

    audio.addEventListener('pause', () => {
      setIsPlaying(false);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    });

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
      if ('mediaSession' in navigator && audio.duration && !isNaN(audio.duration)) {
        try {
          navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate,
            position: audio.currentTime,
          });
        } catch {
          // Ignore unsupported position state edge cases
        }
      }
    });

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration || 0);
    });

    audio.addEventListener('ended', () => {
      handleNextTrack();
    });

    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Update iOS Lockscreen & Control Center MediaSession
  useEffect(() => {
    if (!currentTrack || !('mediaSession' in navigator)) return;

    const artwork = currentTrack.image
      ? [
          { src: currentTrack.image, sizes: '96x96', type: 'image/jpeg' },
          { src: currentTrack.image, sizes: '128x128', type: 'image/jpeg' },
          { src: currentTrack.image, sizes: '192x192', type: 'image/jpeg' },
          { src: currentTrack.image, sizes: '256x256', type: 'image/jpeg' },
          { src: currentTrack.image, sizes: '384x384', type: 'image/jpeg' },
          { src: currentTrack.image, sizes: '512x512', type: 'image/jpeg' },
        ]
      : [{ src: '/icon.svg', sizes: '512x512', type: 'image/svg+xml' }];

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album || 'Flow Player',
      artwork: artwork,
    });

    navigator.mediaSession.setActionHandler('play', () => {
      audioRef.current?.play();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      audioRef.current?.pause();
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      handlePrevTrack();
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      handleNextTrack();
    });

    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined && audioRef.current) {
        audioRef.current.currentTime = details.seekTime;
      }
    });
  }, [currentTrack, queue, queueIndex]);

  const playTrack = (track: Track, newQueue?: Track[]) => {
    if (!audioRef.current) return;

    if (newQueue) {
      setQueue(newQueue);
      const idx = newQueue.findIndex((t) => t.id === track.id);
      setQueueIndex(idx !== -1 ? idx : 0);
    } else {
      // If no queue passed, append or set current track
      setQueue([track]);
      setQueueIndex(0);
    }

    setCurrentTrack(track);
    audioRef.current.src = track.audioUrl;
    audioRef.current.load();
    audioRef.current
      .play()
      .then(() => setIsPlaying(true))
      .catch((err) => {
        console.warn('Audio play request interrupted or prevented:', err);
      });
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
  };

  const handleNextTrack = () => {
    setQueue((q) => {
      setQueueIndex((currIdx) => {
        if (q.length === 0) return -1;
        const nextIdx = currIdx + 1 < q.length ? currIdx + 1 : 0;
        const next = q[nextIdx];
        if (next && audioRef.current) {
          setCurrentTrack(next);
          audioRef.current.src = next.audioUrl;
          audioRef.current.load();
          audioRef.current.play().catch(console.error);
        }
        return nextIdx;
      });
      return q;
    });
  };

  const handlePrevTrack = () => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    setQueue((q) => {
      setQueueIndex((currIdx) => {
        if (q.length === 0) return -1;
        const prevIdx = currIdx - 1 >= 0 ? currIdx - 1 : q.length - 1;
        const prev = q[prevIdx];
        if (prev && audioRef.current) {
          setCurrentTrack(prev);
          audioRef.current.src = prev.audioUrl;
          audioRef.current.load();
          audioRef.current.play().catch(console.error);
        }
        return prevIdx;
      });
      return q;
    });
  };

  const seekTo = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        queue,
        queueIndex,
        currentTime,
        duration,
        isExpanded,
        setIsExpanded,
        playTrack,
        togglePlay,
        playNext: handleNextTrack,
        playPrev: handlePrevTrack,
        seekTo,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within PlayerProvider');
  }
  return context;
}
