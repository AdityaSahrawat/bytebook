'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { Header } from '../components/Header';
import { StatsCards } from '../components/StatsCards';
import { OrderForm } from '../components/OrderForm';
import { OrderBook } from '../components/OrderBook';
import { DepthChart } from '../components/DepthChart';
import { TradeHistory } from '../components/TradeHistory';
import { OpenOrders } from '../components/OpenOrders';
import { WSEventEnvelope, OrderBookSummary, Trade, MarketStats, Order } from '../types';

export default function Dashboard() {
  const queryClient = useQueryClient();

  // Queries for initial data hydration
  const { data: orderBook } = useQuery<OrderBookSummary>({
    queryKey: ['orderbook'],
    queryFn: () => api.getOrderBook(20),
  });

  const { data: trades } = useQuery<Trade[]>({
    queryKey: ['trades'],
    queryFn: () => api.getTrades(50),
  });

  const { data: stats } = useQuery<MarketStats>({
    queryKey: ['stats'],
    queryFn: () => api.getStats(),
  });

  const { data: openOrders } = useQuery<Order[]>({
    queryKey: ['openOrders'],
    queryFn: () => api.getOpenOrders(),
  });

  // Real-time WebSocket event handler (zero latency state updates)
  const handleWSEvent = (envelope: WSEventEnvelope) => {
    if (envelope.type === 'ORDERBOOK_UPDATED') {
      queryClient.setQueryData(['orderbook'], envelope.data);
      queryClient.invalidateQueries({ queryKey: ['openOrders'] });
    } else if (envelope.type === 'TRADE_EXECUTED') {
      queryClient.setQueryData<Trade[]>(['trades'], (prev = []) => [
        envelope.data as Trade,
        ...prev.slice(0, 49),
      ]);
    } else if (envelope.type === 'STATS_UPDATED') {
      queryClient.setQueryData(['stats'], envelope.data);
    }
  };

  const { isConnected, lastSequence } = useWebSocket(handleWSEvent);

  const handleRefetch = () => {
    queryClient.invalidateQueries({ queryKey: ['orderbook'] });
    queryClient.invalidateQueries({ queryKey: ['trades'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
    queryClient.invalidateQueries({ queryKey: ['openOrders'] });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Navbar Header */}
      <Header isConnected={isConnected} lastSequence={lastSequence} />

      {/* Dashboard Main Container */}
      <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Top Metric Cards */}
        <StatsCards stats={stats} />

        {/* Core Trading Layout: 3 Columns on large screens */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Order Form (3 cols) */}
          <div className="lg:col-span-3">
            <OrderForm onSuccess={handleRefetch} />
          </div>

          {/* Center Column: Order Book & Depth Chart (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <OrderBook orderBook={orderBook} />
            <DepthChart orderBook={orderBook} />
          </div>

          {/* Right Column: Trade History & Open Orders (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <TradeHistory trades={trades || []} />
            <OpenOrders orders={openOrders || []} onOrderCancelled={handleRefetch} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-600 font-mono">
        ByteVox Exchange Engine v1.0 • High-Performance Price-Time Priority Matching Engine
      </footer>
    </div>
  );
}
