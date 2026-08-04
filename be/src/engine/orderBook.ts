import { Order, Side, PriceLevel, OrderReference, OrderBookSummary, Status } from '../types';
import { PrecisionMath } from '../utils/decimal';

export class OrderBook {
  private bids: Map<number, PriceLevel> = new Map();
  private asks: Map<number, PriceLevel> = new Map();
  private sortedBidPrices: number[] = []; // Sorted Descending (highest price first)
  private sortedAskPrices: number[] = []; // Sorted Ascending (lowest price first)
  private orderIndex: Map<string, OrderReference> = new Map();

  /**
   * Insert a resting Limit Order into the OrderBook.
   */
  public addLimitOrder(order: Order): void {
    const isBuy = order.side === Side.BUY;
    const price = PrecisionMath.round(order.price);
    const levelsMap = isBuy ? this.bids : this.asks;
    const sortedPrices = isBuy ? this.sortedBidPrices : this.sortedAskPrices;

    let priceLevel = levelsMap.get(price);

    if (!priceLevel) {
      priceLevel = {
        price,
        totalVolume: 0,
        orderCount: 0,
        orderQueue: [],
      };
      levelsMap.set(price, priceLevel);
      this.insertSortedPrice(sortedPrices, price, isBuy);
    }

    priceLevel.orderQueue.push(order);
    priceLevel.totalVolume = PrecisionMath.add(priceLevel.totalVolume, order.remainingQuantity);
    priceLevel.orderCount += 1;

    // Index order pointer for O(1) cancellation and lookup
    this.orderIndex.set(order.id, {
      order,
      priceLevel,
      side: order.side,
    });
  }

  /**
   * Cancel an open order in O(1) time using orderIndex.
   */
  public cancelOrder(orderId: string): Order | null {
    const ref = this.orderIndex.get(orderId);
    if (!ref) return null;

    const { order, priceLevel, side } = ref;
    if (order.status === Status.FILLED || order.status === Status.CANCELLED) {
      return null;
    }

    // Remove order from price level queue
    const index = priceLevel.orderQueue.findIndex((o) => o.id === orderId);
    if (index !== -1) {
      priceLevel.orderQueue.splice(index, 1);
      priceLevel.totalVolume = PrecisionMath.sub(priceLevel.totalVolume, order.remainingQuantity);
      priceLevel.orderCount -= 1;
    }

    // Remove from index
    this.orderIndex.delete(orderId);

    // Update order status
    order.status = Status.CANCELLED;
    order.updatedAt = new Date();

    // Clean up empty price level
    if (priceLevel.orderQueue.length === 0) {
      this.removePriceLevel(side, priceLevel.price);
    }

    return order;
  }

  /**
   * Get best Bid price level (highest price).
   */
  public getBestBid(): PriceLevel | null {
    if (this.sortedBidPrices.length === 0) return null;
    const bestPrice = this.sortedBidPrices[0];
    return this.bids.get(bestPrice) || null;
  }

  /**
   * Get best Ask price level (lowest price).
   */
  public getBestAsk(): PriceLevel | null {
    if (this.sortedAskPrices.length === 0) return null;
    const bestPrice = this.sortedAskPrices[0];
    return this.asks.get(bestPrice) || null;
  }

  /**
   * Remove empty price level from Map and sorted array.
   */
  public removePriceLevel(side: Side, price: number): void {
    const isBuy = side === Side.BUY;
    const levelsMap = isBuy ? this.bids : this.asks;
    const sortedPrices = isBuy ? this.sortedBidPrices : this.sortedAskPrices;

    levelsMap.delete(price);
    const index = sortedPrices.indexOf(price);
    if (index !== -1) {
      sortedPrices.splice(index, 1);
    }
  }

  /**
   * Deduct filled quantity from resting price level and remove order if fully filled.
   */
  public updateRestingOrderQuantity(order: Order, quantityFilled: number): void {
    const ref = this.orderIndex.get(order.id);
    if (!ref) return;

    const { priceLevel, side } = ref;
    order.remainingQuantity = PrecisionMath.sub(order.remainingQuantity, quantityFilled);
    order.updatedAt = new Date();

    priceLevel.totalVolume = PrecisionMath.sub(priceLevel.totalVolume, quantityFilled);

    if (PrecisionMath.equals(order.remainingQuantity, 0)) {
      order.status = Status.FILLED;
      // Remove from queue
      priceLevel.orderQueue.shift(); // FIFO order was at head
      priceLevel.orderCount -= 1;
      this.orderIndex.delete(order.id);

      if (priceLevel.orderQueue.length === 0) {
        this.removePriceLevel(side, priceLevel.price);
      }
    } else {
      order.status = Status.PARTIALLY_FILLED;
    }
  }

  /**
   * Look up order by ID.
   */
  public getOrder(orderId: string): Order | null {
    const ref = this.orderIndex.get(orderId);
    return ref ? ref.order : null;
  }

  /**
   * Get aggregated orderbook snapshot up to specified depth limit.
   */
  public getOrderBookSummary(depth: number = 20): OrderBookSummary {
    const bids = this.sortedBidPrices.slice(0, depth).map((price) => {
      const level = this.bids.get(price)!;
      return {
        price: level.price,
        totalVolume: level.totalVolume,
        orderCount: level.orderCount,
      };
    });

    const asks = this.sortedAskPrices.slice(0, depth).map((price) => {
      const level = this.asks.get(price)!;
      return {
        price: level.price,
        totalVolume: level.totalVolume,
        orderCount: level.orderCount,
      };
    });

    return { bids, asks };
  }

  /**
   * Return total counts of active orders.
   */
  public getOpenOrdersCount(): { buyCount: number; sellCount: number } {
    let buyCount = 0;
    let sellCount = 0;

    for (const ref of this.orderIndex.values()) {
      if (ref.side === Side.BUY) buyCount++;
      else sellCount++;
    }

    return { buyCount, sellCount };
  }

  /**
   * Reset the OrderBook.
   */
  public clear(): void {
    this.bids.clear();
    this.asks.clear();
    this.sortedBidPrices = [];
    this.sortedAskPrices = [];
    this.orderIndex.clear();
  }

  /**
   * Hydrate orderbook from database orders on server startup.
   */
  public hydrate(orders: Order[]): void {
    this.clear();
    // Sort orders by createdAt ASC to preserve price-time priority
    const sorted = [...orders].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const order of sorted) {
      if (order.status === Status.OPEN || order.status === Status.PARTIALLY_FILLED) {
        this.addLimitOrder(order);
      }
    }
  }

  /**
   * Helper to maintain sorted array order.
   */
  private insertSortedPrice(prices: number[], price: number, isBuy: boolean): void {
    const index = prices.findIndex((p) => (isBuy ? p < price : p > price));
    if (index === -1) {
      prices.push(price);
    } else {
      prices.splice(index, 0, price);
    }
  }
}
