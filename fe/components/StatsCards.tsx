'use client';

import { MarketStats } from '../types';
import { formatCurrency, formatQuantity } from '../lib/utils';
import { ArrowUpRight, ArrowDownRight, Layers, BarChart3 } from 'lucide-react';

interface StatsCardsProps {
  stats: MarketStats | undefined;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const openBuy = stats?.openBuyOrders ?? 0;
  const openSell = stats?.openSellOrders ?? 0;
  const trades = stats?.tradesExecuted ?? 0;
  const volume = stats?.totalVolume ?? 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-2">
          <span>Open Bids (Buy)</span>
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-emerald-400 font-mono tracking-tight">
          {openBuy}
        </div>
        <div className="text-[10px] text-slate-500 mt-1">Active resting bids</div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-2">
          <span>Open Asks (Sell)</span>
          <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
            <ArrowDownRight className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-rose-400 font-mono tracking-tight">
          {openSell}
        </div>
        <div className="text-[10px] text-slate-500 mt-1">Active resting asks</div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-2">
          <span>Trades Executed</span>
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-indigo-300 font-mono tracking-tight">
          {trades}
        </div>
        <div className="text-[10px] text-slate-500 mt-1">Total matched orders</div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-2">
          <span>Total Volume</span>
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
            <BarChart3 className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-amber-300 font-mono tracking-tight">
          {formatQuantity(volume, 2)}
        </div>
        <div className="text-[10px] text-slate-500 mt-1">BYTE units traded</div>
      </div>
    </div>
  );
}
