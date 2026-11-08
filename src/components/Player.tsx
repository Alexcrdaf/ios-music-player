'use client';

import React, { useState } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { Play, Pause, ChevronUp, ChevronDown, SkipForward, SkipBack, Music } from 'lucide-react';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function MiniPlayer() {
  const { currentTrack, isPlaying, togglePlay, playNext, setIsExpanded } = usePlayer();

  if (!currentTrack) return null;

  return (
    <div
      onClick={() => setIsExpanded(true)}
      className="fixed bottom-18 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-40 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-2.5 flex items-center justify-between shadow-2xl cursor-pointer transition-all active:scale-[0.98]"
    >
      <div className="flex items-center gap-3 overflow-hidden">
        {currentTrack.image ? (
          <img
            src={currentTrack.image}
            alt={currentTrack.title}
            className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-md"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
            <Music className="w-6 h-6 text-zinc-400" />
          </div>
        )}
        <div className="overflow-hidden pr-2">
          <p className="font-semibold text-sm text-white truncate">{currentTrack.title}</p>
          <p className="text-xs text-zinc-400 truncate">{currentTrack.artist}</p>
        </div>
      </div>

      <div
        className="flex items-center gap-2 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center transition active:scale-90"
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>
        <button
          onClick={playNext}
          className="w-10 h-10 rounded-full text-zinc-300 hover:text-white flex items-center justify-center transition active:scale-90"
        >
          <SkipForward className="w-5 h-5 fill-current" />
        </button>
      </div>
    </div>
  );
}

export function FullPlayer() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    isExpanded,
    setIsExpanded,
    togglePlay,
    playNext,
    playPrev,
    seekTo,
  } = usePlayer();

  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);

  if (!isExpanded || !currentTrack) return null;

  const currentDisplayTime = isDragging ? dragTime : currentTime;
  const progressPercent = duration > 0 ? (currentDisplayTime / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col justify-between px-6 pt-12 pb-10 transition-all duration-300">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(false)}
          className="p-2 text-zinc-400 hover:text-white rounded-full bg-zinc-900/50"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
        <span className="text-xs tracking-wider uppercase text-zinc-400 font-semibold">
          Сейчас играет
        </span>
        <div className="w-10" />
      </div>

      {/* Album Art */}
      <div className="my-auto flex flex-col items-center">
        <div className="w-72 h-72 sm:w-80 sm:h-80 rounded-3xl overflow-hidden shadow-2xl shadow-rose-950/30 border border-white/5">
          {currentTrack.image ? (
            <img
              src={currentTrack.image}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
              <Music className="w-24 h-24 text-zinc-700" />
            </div>
          )}
        </div>

        {/* Track Title & Artist */}
        <div className="w-full text-left mt-8 px-2">
          <h2 className="text-2xl font-bold text-white truncate">{currentTrack.title}</h2>
          <p className="text-lg text-rose-500 font-medium truncate mt-1">
            {currentTrack.artist}
          </p>
          {currentTrack.album && (
            <p className="text-xs text-zinc-500 truncate mt-0.5">{currentTrack.album}</p>
          )}
        </div>
      </div>

      {/* Playback Controls & Progress Bar */}
      <div className="w-full flex flex-col gap-6">
        {/* Scrubber */}
        <div>
          <div className="relative w-full flex items-center group py-2">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentDisplayTime}
              onMouseDown={() => setIsDragging(true)}
              onTouchStart={() => setIsDragging(true)}
              onChange={(e) => setDragTime(Number(e.target.value))}
              onMouseUp={(e) => {
                setIsDragging(false);
                seekTo(Number((e.target as HTMLInputElement).value));
              }}
              onTouchEnd={(e) => {
                setIsDragging(false);
                seekTo(Number((e.target as HTMLInputElement).value));
              }}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-400 font-medium -mt-1">
            <span>{formatTime(currentDisplayTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-around py-2">
          <button
            onClick={playPrev}
            className="p-3 text-zinc-300 hover:text-white transition active:scale-90"
          >
            <SkipBack className="w-9 h-9 fill-current" />
          </button>
          <button
            onClick={togglePlay}
            className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center shadow-lg transition active:scale-90"
          >
            {isPlaying ? (
              <Pause className="w-9 h-9 fill-current" />
            ) : (
              <Play className="w-9 h-9 fill-current ml-1" />
            )}
          </button>
          <button
            onClick={playNext}
            className="p-3 text-zinc-300 hover:text-white transition active:scale-90"
          >
            <SkipForward className="w-9 h-9 fill-current" />
          </button>
        </div>

        {/* Bottom indicator hint */}
        <div className="text-center">
          <span className="text-[11px] text-zinc-500">
            Фоновое воспроизведение активно при выключенном экране
          </span>
        </div>
      </div>
    </div>
  );
}
