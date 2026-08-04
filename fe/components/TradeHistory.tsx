'use client';

import { Trade } from '../types';
import { formatCurrency, formatQuantity, formatTime } from '../lib/utils';
import { History } from 'lucide-react';

interface TradeHistoryProps {
  trades: Trade[];
}

export function TradeHistory({ trades }: TradeHistoryProps) {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-2">
        <div className="flex items-center space-x-2">
          <History className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Trade History</h2>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">Recent Executions</span>
      </div>

      <div className="flex-1 overflow-y-auto font-mono text-xs max-h-[260px]">
        {trades.length === 0 ? (
          <div className="text-center py-10 text-slate-600 text-xs font-sans">
            No trades executed yet
          </div>
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-3 text-[11px] text-slate-500 pb-1 border-b border-slate-800/50 font-sans">
              <span>Time</span>
              <span className="text-right">Price</span>
              <span className="text-right">Qty</span>
            </div>

            {trades.slice(0, 30).map((trade) => (
              <div
                key={trade.id}
                className="grid grid-cols-3 py-1 px-1 rounded hover:bg-slate-800/40 transition-colors text-slate-300"
              >
                <span className="text-slate-500 text-[11px]">{formatTime(trade.executedAt)}</span>
                <span className="text-right font-semibold text-emerald-400">
                  {formatCurrency(trade.price)}
                </span>
                <span className="text-right text-slate-300">{formatQuantity(trade.quantity)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
