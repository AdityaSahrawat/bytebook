'use client';

import { useState } from 'react';
import { Side, Type } from '../types';
import { api } from '../lib/api';
import { formatCurrency } from '../lib/utils';
import { ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';

interface OrderFormProps {
  onSuccess?: () => void;
}

export function OrderForm({ onSuccess }: OrderFormProps) {
  const [side, setSide] = useState<Side>(Side.BUY);
  const [type, setType] = useState<Type>(Type.LIMIT);
  const [price, setPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBuy = side === Side.BUY;
  const numPrice = parseFloat(price) || 0;
  const numQty = parseFloat(quantity) || 0;
  const totalEstimate = type === Type.LIMIT ? numPrice * numQty : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (numQty <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }

    if (type === Type.LIMIT && numPrice <= 0) {
      setError('Limit price must be greater than zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createOrder({
        side,
        type,
        price: type === Type.LIMIT ? numPrice : undefined,
        quantity: numQty,
      });

      // Reset form
      setQuantity('');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to submit order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Order Entry</h2>
          <span className="text-[10px] text-slate-500 font-mono">Spot Trading</span>
        </div>

        {/* Side Tabs: Buy / Sell */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/80 rounded-lg border border-slate-800/80 mb-4">
          <button
            type="button"
            onClick={() => setSide(Side.BUY)}
            className={`flex items-center justify-center space-x-1 py-2 rounded-md text-xs font-bold transition-all ${
              isBuy
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>BUY</span>
          </button>
          <button
            type="button"
            onClick={() => setSide(Side.SELL)}
            className={`flex items-center justify-center space-x-1 py-2 rounded-md text-xs font-bold transition-all ${
              !isBuy
                ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>SELL</span>
          </button>
        </div>

        {/* Type Switcher: Limit / Market */}
        <div className="flex items-center space-x-3 mb-4 bg-slate-950/40 p-1.5 rounded-lg border border-slate-800/50">
          <button
            type="button"
            onClick={() => setType(Type.LIMIT)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              type === Type.LIMIT
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            LIMIT
          </button>
          <button
            type="button"
            onClick={() => {
              setType(Type.MARKET);
              setPrice('');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              type === Type.MARKET
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            MARKET
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Price Input */}
          {type === Type.LIMIT && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Order Price (USDT)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  required
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">
                  USDT
                </span>
              </div>
            </div>
          )}

          {/* Quantity Input */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Quantity (BYTE)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">
                BYTE
              </span>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-800/60 text-xs space-y-1.5 font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Estimated Total:</span>
              <span className="text-white font-bold">
                {type === Type.LIMIT ? `${formatCurrency(totalEstimate)} USDT` : 'Market Price'}
              </span>
            </div>
            {type === Type.MARKET && (
              <p className="text-[10px] text-amber-400/90 font-sans leading-tight">
                ⚡ Market orders execute immediately against best orderbook liquidity.
              </p>
            )}
          </div>

          {error && (
            <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-2 ${
              isBuy
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-rose-500 hover:bg-rose-400 text-slate-950 shadow-lg shadow-rose-500/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Executing...</span>
              </>
            ) : (
              <span>Submit {side} Order</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
