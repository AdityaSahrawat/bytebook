'use client';

import { OrderBookSummary } from '../types';
import { formatCurrency, formatQuantity } from '../lib/utils';

interface DepthChartProps {
  orderBook: OrderBookSummary | undefined;
}

export function DepthChart({ orderBook }: DepthChartProps) {
  const bids = orderBook?.bids ?? [];
  const asks = orderBook?.asks ?? [];

  if (bids.length === 0 && asks.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 shadow-sm flex flex-col justify-center items-center min-h-[220px] text-slate-600 text-xs">
        No active orders to render Market Depth Chart
      </div>
    );
  }

  // Calculate cumulative volumes
  let cumulativeBidVol = 0;
  const bidPoints = bids.map((b) => {
    cumulativeBidVol += b.totalVolume;
    return { price: b.price, cumVol: cumulativeBidVol };
  });

  let cumulativeAskVol = 0;
  const askPoints = asks.map((a) => {
    cumulativeAskVol += a.totalVolume;
    return { price: a.price, cumVol: cumulativeAskVol };
  });

  const maxVol = Math.max(cumulativeBidVol, cumulativeAskVol, 1);
  const minPrice = bids.length > 0 ? bids[bids.length - 1].price * 0.98 : (asks[0]?.price || 100) * 0.9;
  const maxPrice = asks.length > 0 ? asks[asks.length - 1].price * 1.02 : (bids[0]?.price || 100) * 1.1;
  const priceRange = Math.max(maxPrice - minPrice, 1);

  // SVG Geometry helpers
  const svgWidth = 400;
  const svgHeight = 160;

  const getX = (price: number) => ((price - minPrice) / priceRange) * svgWidth;
  const getY = (vol: number) => svgHeight - (vol / maxVol) * (svgHeight - 20);

  // Generate SVG path strings
  let bidPathStr = `M ${getX(minPrice)} ${svgHeight} `;
  bidPoints.forEach((pt) => {
    bidPathStr += `L ${getX(pt.price)} ${getY(pt.cumVol)} `;
  });
  if (bidPoints.length > 0) {
    bidPathStr += `L ${getX(bidPoints[0].price)} ${svgHeight} Z`;
  }

  let askPathStr = askPoints.length > 0 ? `M ${getX(askPoints[0].price)} ${svgHeight} ` : '';
  askPoints.forEach((pt) => {
    askPathStr += `L ${getX(pt.price)} ${getY(pt.cumVol)} `;
  });
  if (askPoints.length > 0) {
    askPathStr += `L ${getX(askPoints[askPoints.length - 1].price)} ${svgHeight} Z`;
  }

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Market Depth Chart</h2>
        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span className="text-slate-400">Bids ({formatQuantity(cumulativeBidVol, 1)})</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            <span className="text-slate-400">Asks ({formatQuantity(cumulativeAskVol, 1)})</span>
          </div>
        </div>
      </div>

      <div className="relative w-full h-[160px] bg-slate-950/60 rounded-lg overflow-hidden border border-slate-800/60 p-2">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full preserve-3d">
          {/* Bids Fill Area */}
          {bidPoints.length > 0 && (
            <path d={bidPathStr} className="fill-emerald-500/20 stroke-emerald-500 stroke-2" />
          )}

          {/* Asks Fill Area */}
          {askPoints.length > 0 && (
            <path d={askPathStr} className="fill-rose-500/20 stroke-rose-500 stroke-2" />
          )}
        </svg>

        <div className="absolute bottom-1 left-3 text-[10px] font-mono text-slate-500">
          Low: {formatCurrency(minPrice)}
        </div>
        <div className="absolute bottom-1 right-3 text-[10px] font-mono text-slate-500">
          High: {formatCurrency(maxPrice)}
        </div>
      </div>
    </div>
  );
}
