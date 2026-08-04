'use client';

import { useState } from 'react';
import { Order, Side, Status } from '../types';
import { api } from '../lib/api';
import { formatCurrency, formatQuantity, formatTime } from '../lib/utils';
import { XCircle, Loader2 } from 'lucide-react';

interface OpenOrdersProps {
  orders: Order[];
  onOrderCancelled?: () => void;
}

export function OpenOrders({ orders, onOrderCancelled }: OpenOrdersProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await api.cancelOrder(id);
      if (onOrderCancelled) onOrderCancelled();
    } catch (err: any) {
      console.error('Failed to cancel order:', err);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-2">
        <div className="flex items-center space-x-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Open Orders</h2>
          <span className="bg-slate-800 text-slate-300 font-mono text-xs px-2 py-0.5 rounded-full">
            {orders.length}
          </span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">Resting Market Orders</span>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto font-mono text-xs max-h-[260px]">
        {orders.length === 0 ? (
          <div className="text-center py-10 text-slate-600 text-xs font-sans">
            No open resting orders in orderbook
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-500 font-sans">
                <th className="py-2 px-2">Time</th>
                <th className="py-2 px-2">Side</th>
                <th className="py-2 px-2 text-right">Price</th>
                <th className="py-2 px-2 text-right">Orig Qty</th>
                <th className="py-2 px-2 text-right">Rem Qty</th>
                <th className="py-2 px-2 text-center">Status</th>
                <th className="py-2 px-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const isBuy = order.side === Side.BUY;
                return (
                  <tr key={order.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-2 text-slate-500 text-[11px]">{formatTime(order.createdAt)}</td>
                    <td className="py-2 px-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isBuy ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}>
                        {order.side}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right font-semibold text-slate-200">
                      {order.price > 0 ? formatCurrency(order.price) : 'MARKET'}
                    </td>
                    <td className="py-2 px-2 text-right text-slate-400">{formatQuantity(order.originalQuantity)}</td>
                    <td className="py-2 px-2 text-right text-amber-300 font-bold">{formatQuantity(order.remainingQuantity)}</td>
                    <td className="py-2 px-2 text-center">
                      <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                        {order.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <button
                        onClick={() => handleCancel(order.id)}
                        disabled={cancellingId === order.id}
                        className="text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 rounded text-[11px] font-sans flex items-center space-x-1 ml-auto transition-colors disabled:opacity-50"
                      >
                        {cancellingId === order.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            <span>Cancel</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
