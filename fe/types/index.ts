export enum Side {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum Type {
  LIMIT = 'LIMIT',
  MARKET = 'MARKET',
}

export enum Status {
  OPEN = 'OPEN',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
}

export interface Order {
  id: string;
  side: Side;
  type: Type;
  price: number;
  originalQuantity: number;
  remainingQuantity: number;
  status: Status;
  createdAt: string;
  updatedAt: string;
}

export interface Trade {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  price: number;
  quantity: number;
  executedAt: string;
  makerOrderId?: string;
  takerOrderId?: string;
}

export interface PriceLevelSummary {
  price: number;
  totalVolume: number;
  orderCount: number;
}

export interface OrderBookSummary {
  bids: PriceLevelSummary[];
  asks: PriceLevelSummary[];
}

export interface MarketStats {
  openBuyOrders: number;
  openSellOrders: number;
  tradesExecuted: number;
  totalVolume: number;
}

export type WSEventType = 'ORDERBOOK_UPDATED' | 'TRADE_EXECUTED' | 'STATS_UPDATED';

export interface WSEventEnvelope<T = unknown> {
  sequence: number;
  type: WSEventType;
  timestamp: string;
  data: T;
}

export interface CreateOrderDTO {
  side: Side;
  type: Type;
  price?: number;
  quantity: number;
}
