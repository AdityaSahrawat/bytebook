import { describe, it, expect, beforeEach } from 'vitest';
import { MatchingEngine } from '../matchingEngine';
import { Side, Type, Status } from '../../types';

describe('MatchingEngine (Domain Layer)', () => {
  let engine: MatchingEngine;

  beforeEach(() => {
    engine = new MatchingEngine();
  });

  it('should create a resting Limit Buy order when order book is empty', () => {
    const result = engine.submitOrder({
      side: Side.BUY,
      type: Type.LIMIT,
      price: 100,
      quantity: 10,
    });

    expect(result.incomingOrder.status).toBe(Status.OPEN);
    expect(result.incomingOrder.remainingQuantity).toBe(10);
    expect(result.createdTrades).toHaveLength(0);

    const summary = engine.getOrderBook().getOrderBookSummary();
    expect(summary.bids).toHaveLength(1);
    expect(summary.bids[0]).toEqual({ price: 100, totalVolume: 10, orderCount: 1 });
  });

  it('should execute an exact match between Buy Limit and Sell Limit orders', () => {
    // 1. Submit SELL LIMIT 10 @ 100
    engine.submitOrder({
      side: Side.SELL,
      type: Type.LIMIT,
      price: 100,
      quantity: 10,
    });

    // 2. Submit BUY LIMIT 10 @ 100
    const result = engine.submitOrder({
      side: Side.BUY,
      type: Type.LIMIT,
      price: 100,
      quantity: 10,
    });

    expect(result.incomingOrder.status).toBe(Status.FILLED);
    expect(result.incomingOrder.remainingQuantity).toBe(0);
    expect(result.createdTrades).toHaveLength(1);
    expect(result.createdTrades[0].price).toBe(100);
    expect(result.createdTrades[0].quantity).toBe(10);

    // Orderbook should be completely empty after match
    const summary = engine.getOrderBook().getOrderBookSummary();
    expect(summary.bids).toHaveLength(0);
    expect(summary.asks).toHaveLength(0);
  });

  it('should handle partial fills correctly without overwriting originalQuantity', () => {
    // 1. Submit SELL LIMIT 3 @ 100
    engine.submitOrder({
      side: Side.SELL,
      type: Type.LIMIT,
      price: 100,
      quantity: 3,
    });

    // 2. Submit BUY LIMIT 10 @ 100
    const result = engine.submitOrder({
      side: Side.BUY,
      type: Type.LIMIT,
      price: 100,
      quantity: 10,
    });

    expect(result.incomingOrder.status).toBe(Status.PARTIALLY_FILLED);
    expect(result.incomingOrder.originalQuantity).toBe(10);
    expect(result.incomingOrder.remainingQuantity).toBe(7);

    expect(result.createdTrades).toHaveLength(1);
    expect(result.createdTrades[0].quantity).toBe(3);

    // Bids should retain remaining 7
    const summary = engine.getOrderBook().getOrderBookSummary();
    expect(summary.bids).toHaveLength(1);
    expect(summary.bids[0]).toEqual({ price: 100, totalVolume: 7, orderCount: 1 });
    expect(summary.asks).toHaveLength(0);
  });

  it('should sweep multiple price levels (multiple fills)', () => {
    // Resting asks: 3 @ 95, 3 @ 98, 4 @ 100
    engine.submitOrder({ side: Side.SELL, type: Type.LIMIT, price: 95, quantity: 3 });
    engine.submitOrder({ side: Side.SELL, type: Type.LIMIT, price: 98, quantity: 3 });
    engine.submitOrder({ side: Side.SELL, type: Type.LIMIT, price: 100, quantity: 4 });

    // Incoming BUY LIMIT 10 @ 100
    const result = engine.submitOrder({
      side: Side.BUY,
      type: Type.LIMIT,
      price: 100,
      quantity: 10,
    });

    expect(result.incomingOrder.status).toBe(Status.FILLED);
    expect(result.createdTrades).toHaveLength(3);
    expect(result.createdTrades[0].price).toBe(95);
    expect(result.createdTrades[0].quantity).toBe(3);
    expect(result.createdTrades[1].price).toBe(98);
    expect(result.createdTrades[1].quantity).toBe(3);
    expect(result.createdTrades[2].price).toBe(100);
    expect(result.createdTrades[2].quantity).toBe(4);

    const summary = engine.getOrderBook().getOrderBookSummary();
    expect(summary.asks).toHaveLength(0);
  });

  it('should execute Market Buy order against cheapest asks and cancel remaining if liquidity exhausts', () => {
    // Resting asks: 5 @ 100
    engine.submitOrder({ side: Side.SELL, type: Type.LIMIT, price: 100, quantity: 5 });

    // BUY MARKET 10
    const result = engine.submitOrder({
      side: Side.BUY,
      type: Type.MARKET,
      quantity: 10,
    });

    expect(result.createdTrades).toHaveLength(1);
    expect(result.createdTrades[0].quantity).toBe(5);
    expect(result.createdTrades[0].price).toBe(100);

    // Remaining 5 should be cancelled because market order never enters orderbook
    expect(result.cancelledOrders).toHaveLength(1);
    expect(result.cancelledOrders[0].status).toBe(Status.CANCELLED);
    expect(result.cancelledOrders[0].remainingQuantity).toBe(5);

    const summary = engine.getOrderBook().getOrderBookSummary();
    expect(summary.bids).toHaveLength(0);
    expect(summary.asks).toHaveLength(0);
  });

  it('should execute Market Sell order against highest bids', () => {
    // Resting bids: 5 @ 105, 5 @ 100
    engine.submitOrder({ side: Side.BUY, type: Type.LIMIT, price: 105, quantity: 5 });
    engine.submitOrder({ side: Side.BUY, type: Type.LIMIT, price: 100, quantity: 5 });

    // SELL MARKET 8
    const result = engine.submitOrder({
      side: Side.SELL,
      type: Type.MARKET,
      quantity: 8,
    });

    expect(result.createdTrades).toHaveLength(2);
    expect(result.createdTrades[0].price).toBe(105);
    expect(result.createdTrades[0].quantity).toBe(5);
    expect(result.createdTrades[1].price).toBe(100);
    expect(result.createdTrades[1].quantity).toBe(3);

    const summary = engine.getOrderBook().getOrderBookSummary();
    expect(summary.bids).toHaveLength(1);
    expect(summary.bids[0]).toEqual({ price: 100, totalVolume: 2, orderCount: 1 });
  });

  it('should cancel market order entirely when no liquidity is available', () => {
    const result = engine.submitOrder({
      side: Side.BUY,
      type: Type.MARKET,
      quantity: 10,
    });

    expect(result.createdTrades).toHaveLength(0);
    expect(result.cancelledOrders).toHaveLength(1);
    expect(result.cancelledOrders[0].status).toBe(Status.CANCELLED);
  });

  it('should enforce FIFO priority for orders at identical price levels', () => {
    // Two SELL orders at $100: Order1 (qty 5), Order2 (qty 5)
    const order1 = engine.submitOrder({ side: Side.SELL, type: Type.LIMIT, price: 100, quantity: 5 }).incomingOrder;
    const order2 = engine.submitOrder({ side: Side.SELL, type: Type.LIMIT, price: 100, quantity: 5 }).incomingOrder;

    // BUY LIMIT 5 @ 100 should match against Order1 first
    const result = engine.submitOrder({ side: Side.BUY, type: Type.LIMIT, price: 100, quantity: 5 });

    expect(result.createdTrades).toHaveLength(1);
    expect(result.createdTrades[0].sellOrderId).toBe(order1.id);

    // Remaining order in book should be Order2
    const summary = engine.getOrderBook().getOrderBookSummary();
    expect(summary.asks[0].orderCount).toBe(1);
    expect(summary.asks[0].totalVolume).toBe(5);
  });

  it('should enforce Price Priority (highest buy / lowest sell executed first)', () => {
    // Bids at $100 and $105
    engine.submitOrder({ side: Side.BUY, type: Type.LIMIT, price: 100, quantity: 5 });
    const highBid = engine.submitOrder({ side: Side.BUY, type: Type.LIMIT, price: 105, quantity: 5 }).incomingOrder;

    // SELL LIMIT 3 @ 95 should match highBid ($105) first
    const result = engine.submitOrder({ side: Side.SELL, type: Type.LIMIT, price: 95, quantity: 3 });

    expect(result.createdTrades).toHaveLength(1);
    expect(result.createdTrades[0].buyOrderId).toBe(highBid.id);
    expect(result.createdTrades[0].price).toBe(105);
  });

  it('should cancel an open order in O(1) time and update orderbook', () => {
    const order = engine.submitOrder({ side: Side.BUY, type: Type.LIMIT, price: 100, quantity: 10 }).incomingOrder;

    let summary = engine.getOrderBook().getOrderBookSummary();
    expect(summary.bids).toHaveLength(1);

    const cancelled = engine.cancelOrder(order.id);
    expect(cancelled).not.toBeNull();
    expect(cancelled?.status).toBe(Status.CANCELLED);

    summary = engine.getOrderBook().getOrderBookSummary();
    expect(summary.bids).toHaveLength(0);
  });

  it('should reject invalid order inputs', () => {
    expect(() => engine.submitOrder({ side: Side.BUY, type: Type.LIMIT, price: 0, quantity: 10 })).toThrow();
    expect(() => engine.submitOrder({ side: Side.BUY, type: Type.LIMIT, price: -5, quantity: 10 })).toThrow();
    expect(() => engine.submitOrder({ side: Side.BUY, type: Type.LIMIT, price: 100, quantity: -1 })).toThrow();
    expect(() => engine.submitOrder({ side: Side.BUY, type: Type.MARKET, price: 100, quantity: 10 })).toThrow();
  });
});
