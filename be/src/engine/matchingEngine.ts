import { randomUUID } from 'crypto';
import { Order, Trade, Side, Type, Status, MatchingResult, CreateOrderDTO } from '../types';
import { OrderBook } from './orderBook';
import { PrecisionMath } from '../utils/decimal';

export class MatchingEngine {
  private orderBook: OrderBook;

  constructor(orderBook?: OrderBook) {
    this.orderBook = orderBook || new OrderBook();
  }

  public getOrderBook(): OrderBook {
    return this.orderBook;
  }

  /**
   * Process an incoming order and execute matching.
   * Does NOT touch DB or Express. Pure domain function.
   */
  public submitOrder(dto: CreateOrderDTO): MatchingResult {
    this.validateOrderInput(dto);

    const now = new Date();
    const incoming: Order = {
      id: randomUUID(),
      side: dto.side,
      type: dto.type,
      price: dto.type === Type.LIMIT ? PrecisionMath.round(dto.price!) : 0,
      originalQuantity: PrecisionMath.round(dto.quantity),
      remainingQuantity: PrecisionMath.round(dto.quantity),
      status: Status.OPEN,
      createdAt: now,
      updatedAt: now,
    };

    const updatedOrdersMap = new Map<string, Order>();
    const createdTrades: Trade[] = [];
    const cancelledOrders: Order[] = [];

    if (incoming.type === Type.LIMIT) {
      if (incoming.side === Side.BUY) {
        this.matchBuyLimit(incoming, updatedOrdersMap, createdTrades);
      } else {
        this.matchSellLimit(incoming, updatedOrdersMap, createdTrades);
      }
    } else {
      if (incoming.side === Side.BUY) {
        this.matchBuyMarket(incoming, updatedOrdersMap, createdTrades, cancelledOrders);
      } else {
        this.matchSellMarket(incoming, updatedOrdersMap, createdTrades, cancelledOrders);
      }
    }

    return {
      incomingOrder: incoming,
      updatedOrders: Array.from(updatedOrdersMap.values()),
      createdTrades,
      cancelledOrders,
    };
  }

  /**
   * Cancel an active resting order in the OrderBook.
   */
  public cancelOrder(orderId: string): Order | null {
    return this.orderBook.cancelOrder(orderId);
  }

  // Private matching routines

  private matchBuyLimit(
    incoming: Order,
    updatedOrdersMap: Map<string, Order>,
    createdTrades: Trade[]
  ): void {
    let bestAsk = this.orderBook.getBestAsk();

    while (
      incoming.remainingQuantity > 0 &&
      bestAsk !== null &&
      PrecisionMath.lte(bestAsk.price, incoming.price)
    ) {
      const restingOrder = bestAsk.orderQueue[0];
      const matchQty = Math.min(incoming.remainingQuantity, restingOrder.remainingQuantity);
      const tradePrice = restingOrder.price; // Maker price rule

      incoming.remainingQuantity = PrecisionMath.sub(incoming.remainingQuantity, matchQty);
      this.orderBook.updateRestingOrderQuantity(restingOrder, matchQty);

      createdTrades.push({
        id: randomUUID(),
        buyOrderId: incoming.id,
        sellOrderId: restingOrder.id,
        price: tradePrice,
        quantity: matchQty,
        executedAt: new Date(),
        makerOrderId: restingOrder.id,
        takerOrderId: incoming.id,
      });

      updatedOrdersMap.set(restingOrder.id, { ...restingOrder });
      bestAsk = this.orderBook.getBestAsk();
    }

    if (incoming.remainingQuantity > 0) {
      incoming.status =
        incoming.remainingQuantity < incoming.originalQuantity
          ? Status.PARTIALLY_FILLED
          : Status.OPEN;
      this.orderBook.addLimitOrder(incoming);
    } else {
      incoming.status = Status.FILLED;
    }
  }

  private matchSellLimit(
    incoming: Order,
    updatedOrdersMap: Map<string, Order>,
    createdTrades: Trade[]
  ): void {
    let bestBid = this.orderBook.getBestBid();

    while (
      incoming.remainingQuantity > 0 &&
      bestBid !== null &&
      PrecisionMath.gte(bestBid.price, incoming.price)
    ) {
      const restingOrder = bestBid.orderQueue[0];
      const matchQty = Math.min(incoming.remainingQuantity, restingOrder.remainingQuantity);
      const tradePrice = restingOrder.price; // Maker price rule

      incoming.remainingQuantity = PrecisionMath.sub(incoming.remainingQuantity, matchQty);
      this.orderBook.updateRestingOrderQuantity(restingOrder, matchQty);

      createdTrades.push({
        id: randomUUID(),
        buyOrderId: restingOrder.id,
        sellOrderId: incoming.id,
        price: tradePrice,
        quantity: matchQty,
        executedAt: new Date(),
        makerOrderId: restingOrder.id,
        takerOrderId: incoming.id,
      });

      updatedOrdersMap.set(restingOrder.id, { ...restingOrder });
      bestBid = this.orderBook.getBestBid();
    }

    if (incoming.remainingQuantity > 0) {
      incoming.status =
        incoming.remainingQuantity < incoming.originalQuantity
          ? Status.PARTIALLY_FILLED
          : Status.OPEN;
      this.orderBook.addLimitOrder(incoming);
    } else {
      incoming.status = Status.FILLED;
    }
  }

  private matchBuyMarket(
    incoming: Order,
    updatedOrdersMap: Map<string, Order>,
    createdTrades: Trade[],
    cancelledOrders: Order[]
  ): void {
    let bestAsk = this.orderBook.getBestAsk();

    while (incoming.remainingQuantity > 0 && bestAsk !== null) {
      const restingOrder = bestAsk.orderQueue[0];
      const matchQty = Math.min(incoming.remainingQuantity, restingOrder.remainingQuantity);
      const tradePrice = restingOrder.price;

      incoming.remainingQuantity = PrecisionMath.sub(incoming.remainingQuantity, matchQty);
      this.orderBook.updateRestingOrderQuantity(restingOrder, matchQty);

      createdTrades.push({
        id: randomUUID(),
        buyOrderId: incoming.id,
        sellOrderId: restingOrder.id,
        price: tradePrice,
        quantity: matchQty,
        executedAt: new Date(),
        makerOrderId: restingOrder.id,
        takerOrderId: incoming.id,
      });

      updatedOrdersMap.set(restingOrder.id, { ...restingOrder });
      bestAsk = this.orderBook.getBestAsk();
    }

    if (incoming.remainingQuantity > 0) {
      // Market order never enters book. Remaining is cancelled due to lack of liquidity.
      incoming.status = Status.CANCELLED;
      cancelledOrders.push(incoming);
    } else {
      incoming.status = Status.FILLED;
    }
  }

  private matchSellMarket(
    incoming: Order,
    updatedOrdersMap: Map<string, Order>,
    createdTrades: Trade[],
    cancelledOrders: Order[]
  ): void {
    let bestBid = this.orderBook.getBestBid();

    while (incoming.remainingQuantity > 0 && bestBid !== null) {
      const restingOrder = bestBid.orderQueue[0];
      const matchQty = Math.min(incoming.remainingQuantity, restingOrder.remainingQuantity);
      const tradePrice = restingOrder.price;

      incoming.remainingQuantity = PrecisionMath.sub(incoming.remainingQuantity, matchQty);
      this.orderBook.updateRestingOrderQuantity(restingOrder, matchQty);

      createdTrades.push({
        id: randomUUID(),
        buyOrderId: restingOrder.id,
        sellOrderId: incoming.id,
        price: tradePrice,
        quantity: matchQty,
        executedAt: new Date(),
        makerOrderId: restingOrder.id,
        takerOrderId: incoming.id,
      });

      updatedOrdersMap.set(restingOrder.id, { ...restingOrder });
      bestBid = this.orderBook.getBestBid();
    }

    if (incoming.remainingQuantity > 0) {
      // Market order never enters book. Remaining is cancelled due to lack of liquidity.
      incoming.status = Status.CANCELLED;
      cancelledOrders.push(incoming);
    } else {
      incoming.status = Status.FILLED;
    }
  }

  private validateOrderInput(dto: CreateOrderDTO): void {
    if (!dto.side || !Object.values(Side).includes(dto.side)) {
      throw new Error('Invalid order side. Must be BUY or SELL.');
    }
    if (!dto.type || !Object.values(Type).includes(dto.type)) {
      throw new Error('Invalid order type. Must be LIMIT or MARKET.');
    }
    if (dto.quantity <= 0 || !Number.isFinite(dto.quantity)) {
      throw new Error('Quantity must be greater than zero.');
    }
    if (dto.type === Type.LIMIT) {
      if (dto.price === undefined || dto.price === null || dto.price <= 0 || !Number.isFinite(dto.price)) {
        throw new Error('Limit order price must be specified and greater than zero.');
      }
    }
    if (dto.type === Type.MARKET && dto.price !== undefined && dto.price !== null) {
      throw new Error('Market order price should not be specified.');
    }
  }
}
