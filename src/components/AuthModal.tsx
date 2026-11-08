'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { User, Lock, ArrowRight, Music2, Sparkles } from 'lucide-react';

export function AuthModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = isRegister ? await register(username, password) : await login(username, password);

      if (res.success) {
        onClose();
        setUsername('');
        setPassword('');
      } else {
        setError(res.error || 'Ошибка авторизации');
      }
    } catch {
      setError('Произошла непредвиденная ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 sm:p-8 w-full max-w-sm shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white text-sm px-2 py-1"
        >
          ✕
        </button>

        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-500/20 mb-3">
            <Music2 className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-white">
            {isRegister ? 'Регистрация аккаунта' : 'Вход в аккаунт'}
          </h3>
          <p className="text-xs text-zinc-400 text-center mt-1">
            Синхронизация плейлистов между ноутбуком и iPhone
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="relative flex items-center">
            <User className="absolute left-3.5 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Логин"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full bg-zinc-800/80 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition"
            />
          </div>

          <div className="relative flex items-center">
            <Lock className="absolute left-3.5 w-4 h-4 text-zinc-500" />
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-zinc-800/80 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 hover:opacity-95 active:scale-95 transition disabled:opacity-50"
          >
            {loading ? 'Секунду...' : isRegister ? 'Создать аккаунт' : 'Войти'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            className="text-xs text-zinc-400 hover:text-white transition"
          >
            {isRegister
              ? 'Уже есть аккаунт? Войти'
              : 'Нет аккаунта? Зарегистрироваться за пару секунд'}
          </button>
        </div>
      </div>
    </div>
  );
}
