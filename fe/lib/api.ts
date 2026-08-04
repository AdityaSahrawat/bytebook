import { CreateOrderDTO, Order, Trade, OrderBookSummary, MarketStats } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || json.details?.[0]?.message || 'API Request Failed');
  }

  return json.data;
}

export const api = {
  createOrder: (dto: CreateOrderDTO) =>
    fetchJSON<{ order: Order; trades: Trade[] }>('/orders', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  getOrderBook: (depth = 20) =>
    fetchJSON<OrderBookSummary>(`/orderbook?depth=${depth}`),

  getTrades: (limit = 50) =>
    fetchJSON<Trade[]>(`/trades?limit=${limit}`),

  getStats: () =>
    fetchJSON<MarketStats>('/stats'),

  getOpenOrders: () =>
    fetchJSON<Order[]>('/orders/open'),

  cancelOrder: (id: string) =>
    fetchJSON<Order>(`/orders/${id}`, {
      method: 'DELETE',
    }),
};
