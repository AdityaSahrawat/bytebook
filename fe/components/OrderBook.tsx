'use client';

import { OrderBookSummary } from '../types';
import { formatCurrency, formatQuantity } from '../lib/utils';

interface OrderBookProps {
  orderBook: OrderBookSummary | undefined;
}

export function OrderBook({ orderBook }: OrderBookProps) {
  const bids = orderBook?.bids ?? [];
  const asks = orderBook?.asks ?? [];

  // Calculate max volume for visual depth bars
  const maxBidVol = bids.reduce((acc, b) => Math.max(acc, b.totalVolume), 0);
  const maxAskVol = asks.reduce((acc, a) => Math.max(acc, a.totalVolume), 0);
  const maxVol = Math.max(maxBidVol, maxAskVol, 1);

  const bestBid = bids[0]?.price;
  const bestAsk = asks[0]?.price;
  const spread = bestAsk && bestBid ? (bestAsk - bestBid).toFixed(2) : '-';

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Order Book</h2>
        <div className="flex items-center space-x-4 text-[11px] font-mono text-slate-400">
          <span>Price (USDT)</span>
          <span>Size (BYTE)</span>
        </div>
      </div>

      {/* Main OrderBook List */}
      <div className="flex-1 flex flex-col justify-between font-mono text-xs overflow-hidden">
        {/* Asks (Sell Side - Red) */}
        <div className="flex flex-col-reverse justify-end space-y-0.5 space-y-reverse overflow-y-auto max-h-[220px]">
          {asks.length === 0 ? (
            <div className="text-center py-6 text-slate-600 text-xs font-sans">No Sell Asks</div>
          ) : (
            asks.map((ask) => {
              const depthPct = Math.min((ask.totalVolume / maxVol) * 100, 100);
              return (
                <div key={`ask-${ask.price}`} className="relative flex items-center justify-between py-1 px-2 rounded hover:bg-slate-800/40 group">
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-rose-500/10 transition-all pointer-events-none rounded"
                    style={{ width: `${depthPct}%` }}
                  />
                  <span className="text-rose-400 font-semibold z-10">{formatCurrency(ask.price)}</span>
                  <span className="text-slate-300 z-10">{formatQuantity(ask.totalVolume)}</span>
                </div>
              );
            })
          )}
        </div>

        {/* Market Spread Indicator */}
        <div className="my-2 py-1.5 px-3 bg-slate-950/80 border border-slate-800/80 rounded-lg flex items-center justify-between text-xs">
          <span className="text-slate-500 font-sans text-[11px]">Spread</span>
          <span className="text-slate-300 font-semibold font-mono">{spread} USDT</span>
        </div>

        {/* Bids (Buy Side - Green) */}
        <div className="flex flex-col space-y-0.5 overflow-y-auto max-h-[220px]">
          {bids.length === 0 ? (
            <div className="text-center py-6 text-slate-600 text-xs font-sans">No Buy Bids</div>
          ) : (
            bids.map((bid) => {
              const depthPct = Math.min((bid.totalVolume / maxVol) * 100, 100);
              return (
                <div key={`bid-${bid.price}`} className="relative flex items-center justify-between py-1 px-2 rounded hover:bg-slate-800/40 group">
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 transition-all pointer-events-none rounded"
                    style={{ width: `${depthPct}%` }}
                  />
                  <span className="text-emerald-400 font-semibold z-10">{formatCurrency(bid.price)}</span>
                  <span className="text-slate-300 z-10">{formatQuantity(bid.totalVolume)}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
