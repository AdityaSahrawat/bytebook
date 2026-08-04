import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { Order, Trade, MatchingResult, MarketStats, Status, Side, Type } from '../types';

type PrismaOrder = Awaited<ReturnType<typeof prisma.order.findMany>>[number];
type PrismaTrade = Awaited<ReturnType<typeof prisma.trade.findMany>>[number];

export class OrderRepository {
  /**
   * Persist pure MatchingResult into PostgreSQL atomically via Prisma Transaction.
   */
  public async persistMatchingResult(result: MatchingResult): Promise<void> {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Create incoming order
      await tx.order.create({
        data: {
          id: result.incomingOrder.id,
          side: result.incomingOrder.side as unknown as Side,
          type: result.incomingOrder.type as unknown as Type,
          price: result.incomingOrder.price,
          originalQuantity: result.incomingOrder.originalQuantity,
          remainingQuantity: result.incomingOrder.remainingQuantity,
          status: result.incomingOrder.status as unknown as Status,
          createdAt: result.incomingOrder.createdAt,
          updatedAt: result.incomingOrder.updatedAt,
        },
      });

      // 2. Update existing resting orders modified during match
      for (const order of result.updatedOrders) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            remainingQuantity: order.remainingQuantity,
            status: order.status as unknown as Status,
            updatedAt: order.updatedAt,
          },
        });
      }

      // 3. Update cancelled market orders (if any)
      for (const order of result.cancelledOrders) {
        if (order.id !== result.incomingOrder.id) {
          await tx.order.update({
            where: { id: order.id },
            data: {
              remainingQuantity: order.remainingQuantity,
              status: Status.CANCELLED,
              updatedAt: order.updatedAt,
            },
          });
        }
      }

      // 4. Create executed trades
      if (result.createdTrades.length > 0) {
        await tx.trade.createMany({
          data: result.createdTrades.map((t) => ({
            id: t.id,
            buyOrderId: t.buyOrderId,
            sellOrderId: t.sellOrderId,
            price: t.price,
            quantity: t.quantity,
            executedAt: t.executedAt,
          })),
        });
      }
    });
  }

  /**
   * Persist single order status update (e.g. cancellation).
   */
  public async updateOrderStatus(orderId: string, status: Status): Promise<Order> {
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: status as unknown as Status,
        updatedAt: new Date(),
      },
    });

    return {
      id: updated.id,
      side: updated.side as unknown as Side,
      type: updated.type as unknown as Type,
      price: updated.price,
      originalQuantity: updated.originalQuantity,
      remainingQuantity: updated.remainingQuantity,
      status: updated.status as unknown as Status,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Fetch active resting orders for server startup hydration or API requests.
   */
  public async getActiveOrders(): Promise<Order[]> {
    const records = await prisma.order.findMany({
      where: {
        status: {
          in: [Status.OPEN, Status.PARTIALLY_FILLED],
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return records.map((r: PrismaOrder) => ({
      id: r.id,
      side: r.side as unknown as Side,
      type: r.type as unknown as Type,
      price: r.price,
      originalQuantity: r.originalQuantity,
      remainingQuantity: r.remainingQuantity,
      status: r.status as unknown as Status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * Get recent executed trades ordered newest first.
   */
  public async getRecentTrades(limit: number = 50): Promise<Trade[]> {
    const records = await prisma.trade.findMany({
      take: limit,
      orderBy: {
        executedAt: 'desc',
      },
    });

    return records.map((r: PrismaTrade) => ({
      id: r.id,
      buyOrderId: r.buyOrderId,
      sellOrderId: r.sellOrderId,
      price: r.price,
      quantity: r.quantity,
      executedAt: r.executedAt,
    }));
  }

  /**
   * Get aggregated market statistics.
   */
  public async getMarketStats(): Promise<MarketStats> {
    const openBuyOrders = await prisma.order.count({
      where: { side: Side.BUY, status: { in: [Status.OPEN, Status.PARTIALLY_FILLED] } },
    });

    const openSellOrders = await prisma.order.count({
      where: { side: Side.SELL, status: { in: [Status.OPEN, Status.PARTIALLY_FILLED] } },
    });

    const tradesExecuted = await prisma.trade.count();

    const volumeAggregate = await prisma.trade.aggregate({
      _sum: {
        quantity: true,
      },
    });

    return {
      openBuyOrders,
      openSellOrders,
      tradesExecuted,
      totalVolume: volumeAggregate._sum.quantity || 0,
    };
  }
}
