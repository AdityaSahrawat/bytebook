'use client';

import { Activity, Wifi, WifiOff } from 'lucide-react';

interface HeaderProps {
  isConnected: boolean;
  lastSequence: number | null;
}

export function Header({ isConnected, lastSequence }: HeaderProps) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 font-bold text-lg">
            ⚡
          </div>
          <span className="text-xl font-bold tracking-wider text-white">BYTEVOX</span>
        </div>
        <div className="h-5 w-px bg-slate-800" />
        <div className="flex items-center space-x-2 bg-slate-800/60 px-3 py-1 rounded-md border border-slate-700/50 text-xs font-mono text-slate-300">
          <span className="font-semibold text-white">BYTE / USDT</span>
          <span className="text-emerald-400">SPOT</span>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {lastSequence !== null && (
          <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-400 bg-slate-800/40 px-2.5 py-1 rounded border border-slate-800">
            <Activity className="w-3.5 h-3.5 text-slate-500" />
            <span>Seq: <strong className="text-slate-200 font-mono">#{lastSequence}</strong></span>
          </div>
        )}

        <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium border ${
          isConnected
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          {isConnected ? <Wifi className="w-3.5 h-3.5 animate-pulse" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span>{isConnected ? 'Real-time Live' : 'Reconnecting...'}</span>
        </div>
      </div>
    </header>
  );
}
