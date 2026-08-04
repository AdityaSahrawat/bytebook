import { Mutex } from 'async-mutex';
import { MatchingEngine } from '../engine/matchingEngine';
import { OrderRepository } from '../repositories/order.repository';
import { WebSocketServerManager } from '../websocket/wsServer';
import { CreateOrderDTO, Order, Trade, OrderBookSummary, MarketStats, Status } from '../types';

export class OrderService {
  private matchingEngine: MatchingEngine;
  private orderRepository: OrderRepository;
  private wsServer?: WebSocketServerManager;
  private mutex: Mutex;

  constructor(
    matchingEngine: MatchingEngine,
    orderRepository: OrderRepository,
    wsServer?: WebSocketServerManager
  ) {
    this.matchingEngine = matchingEngine;
    this.orderRepository = orderRepository;
    this.wsServer = wsServer;
    this.mutex = new Mutex();
  }

  public setWebSocketServer(wsServer: WebSocketServerManager): void {
    this.wsServer = wsServer;
  }

  /**
   * Hydrate order book from DB on server startup.
   */
  public async hydrateOnBoot(): Promise<void> {
    const activeOrders = await this.orderRepository.getActiveOrders();
    this.matchingEngine.getOrderBook().hydrate(activeOrders);
    console.log(`🚀 OrderBook hydrated with ${activeOrders.length} active resting orders from DB.`);
  }

  /**
   * Submit an order inside the single-writer Mutex critical section.
   */
  public async submitOrder(dto: CreateOrderDTO): Promise<{ order: Order; trades: Trade[] }> {
    return this.mutex.runExclusive(async () => {
      // 1. Domain matching engine computation
      const result = this.matchingEngine.submitOrder(dto);

      // 2. Atomic persistence to PostgreSQL via Prisma transaction
      await this.orderRepository.persistMatchingResult(result);

      // 3. Broadcast real-time WebSocket events
      if (this.wsServer) {
        const orderbookSummary = this.matchingEngine.getOrderBook().getOrderBookSummary(20);
        this.wsServer.broadcast('ORDERBOOK_UPDATED', orderbookSummary);

        if (result.createdTrades.length > 0) {
          for (const trade of result.createdTrades) {
            this.wsServer.broadcast('TRADE_EXECUTED', trade);
          }
        }

        const stats = await this.orderRepository.getMarketStats();
        this.wsServer.broadcast('STATS_UPDATED', stats);
      }

      return {
        order: result.incomingOrder,
        trades: result.createdTrades,
      };
    });
  }

  /**
   * Cancel an open resting order inside Mutex critical section.
   */
  public async cancelOrder(orderId: string): Promise<Order> {
    return this.mutex.runExclusive(async () => {
      const cancelledOrder = this.matchingEngine.cancelOrder(orderId);

      if (!cancelledOrder) {
        throw new Error('Order not found or cannot be cancelled (already FILLED or CANCELLED).');
      }

      // Persist status change in DB
      const updatedOrder = await this.orderRepository.updateOrderStatus(
        orderId,
        Status.CANCELLED
      );

      // Broadcast WebSocket updates
      if (this.wsServer) {
        const orderbookSummary = this.matchingEngine.getOrderBook().getOrderBookSummary(20);
        this.wsServer.broadcast('ORDERBOOK_UPDATED', orderbookSummary);

        const stats = await this.orderRepository.getMarketStats();
        this.wsServer.broadcast('STATS_UPDATED', stats);
      }

      return updatedOrder;
    });
  }

  public getOrderBookSummary(depth: number = 20): OrderBookSummary {
    return this.matchingEngine.getOrderBook().getOrderBookSummary(depth);
  }

  public async getRecentTrades(limit: number = 50): Promise<Trade[]> {
    return this.orderRepository.getRecentTrades(limit);
  }

  public async getMarketStats(): Promise<MarketStats> {
    return this.orderRepository.getMarketStats();
  }

  public async getActiveOrders(): Promise<Order[]> {
    return this.orderRepository.getActiveOrders();
  }
}
