'use client';

import React, { useState } from 'react';
import AegisRadarLogo from '@/components/AegisRadarLogo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: { id: string; name: string; email: string }) => void;
  initialTab?: 'login' | 'register';
}

export default function AuthModal({ isOpen, onClose, onSuccess, initialTab = 'login' }: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email || !password) {
      setErrorMsg('Please provide both email and password.');
      return;
    }

    if (tab === 'register') {
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload = tab === 'login' ? { email, password } : { name, email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.success && data.user) {
        onSuccess(data.user);
        onClose();
      } else {
        setErrorMsg(data.error || 'Authentication failed. Please check your credentials.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 font-mono"
      onClick={onClose}
    >
      <div
        className="bg-[#030903] border border-emerald-500 max-w-md w-full p-5 sm:p-6 shadow-[0_0_30px_rgba(34,197,94,0.25)] relative overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-emerald-500/40 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <AegisRadarLogo size={32} />
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Aegis Radar Account</h2>
              <p className="text-[10px] text-slate-300">
                Save &amp; isolate your personal scrape archive
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white border border-neutral-700 hover:border-neutral-500 px-2 py-0.5 text-xs font-bold transition-all"
          >
            ✕
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex border border-emerald-500/50 mb-5 bg-black">
          <button
            type="button"
            onClick={() => { setTab('login'); setErrorMsg(null); }}
            className={`flex-1 py-2 text-xs font-bold transition-all uppercase ${
              tab === 'login'
                ? 'bg-emerald-500 text-black font-black shadow-[0_0_10px_rgba(34,197,94,0.4)]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setErrorMsg(null); }}
            className={`flex-1 py-2 text-xs font-bold transition-all uppercase ${
              tab === 'register'
                ? 'bg-emerald-500 text-black font-black shadow-[0_0_10px_rgba(34,197,94,0.4)]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 bg-red-950/80 border border-red-500 p-3 text-white text-xs font-mono flex items-start gap-2">
            <span className="shrink-0 text-red-400">⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {tab === 'register' && (
            <div>
              <label className="block text-[11px] text-white font-bold mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full bg-black border border-neutral-700 text-white px-3 py-2 text-xs font-mono focus:outline-none focus:border-emerald-400 placeholder-neutral-600"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] text-white font-bold mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full bg-black border border-neutral-700 text-white px-3 py-2 text-xs font-mono focus:outline-none focus:border-emerald-400 placeholder-neutral-600"
            />
          </div>

          <div>
            <label className="block text-[11px] text-white font-bold mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tab === 'register' ? 'Min 6 characters' : 'Enter password'}
              className="w-full bg-black border border-neutral-700 text-white px-3 py-2 text-xs font-mono focus:outline-none focus:border-emerald-400 placeholder-neutral-600"
            />
          </div>

          {tab === 'register' && (
            <div>
              <label className="block text-[11px] text-white font-bold mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full bg-black border border-neutral-700 text-white px-3 py-2 text-xs font-mono focus:outline-none focus:border-emerald-400 placeholder-neutral-600"
              />
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs border border-emerald-400 transition-all shadow-[0_0_12px_rgba(34,197,94,0.4)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 uppercase tracking-wider"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent animate-spin"></div>
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>{tab === 'login' ? 'Sign In' : 'Create Free Account'}</span>
              )}
            </button>
          </div>
        </form>

        {/* Bottom Notice */}
        <div className="mt-4 pt-3 border-t border-emerald-500/30 text-center">
          <p className="text-[10px] text-slate-400">
            ⚡ Instant Guest Mode is always active. Close to scrape without saving.
          </p>
        </div>
      </div>
    </div>
  );
}
