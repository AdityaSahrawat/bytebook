import { FastifyRequest, FastifyReply } from 'fastify';
import { OrderService } from '../services/order.service';
import { CreateOrderDTO, Side, Type } from '../types';

export class OrderController {
  private orderService: OrderService;

  constructor(orderService: OrderService) {
    this.orderService = orderService;
  }

  public createOrder = async (
    request: FastifyRequest<{ Body: CreateOrderDTO }>,
    reply: FastifyReply
  ) => {
    try {
      const body = request.body;

      // Input Validation
      if (!body.side || !Object.values(Side).includes(body.side)) {
        return reply.status(400).send({
          success: false,
          error: 'Validation Error',
          details: [{ field: 'side', message: 'Side must be BUY or SELL' }],
        });
      }

      if (!body.type || !Object.values(Type).includes(body.type)) {
        return reply.status(400).send({
          success: false,
          error: 'Validation Error',
          details: [{ field: 'type', message: 'Type must be LIMIT or MARKET' }],
        });
      }

      if (!body.quantity || body.quantity <= 0) {
        return reply.status(400).send({
          success: false,
          error: 'Validation Error',
          details: [{ field: 'quantity', message: 'Quantity must be greater than zero' }],
        });
      }

      if (body.type === Type.LIMIT && (!body.price || body.price <= 0)) {
        return reply.status(400).send({
          success: false,
          error: 'Validation Error',
          details: [{ field: 'price', message: 'LIMIT order requires a price > 0' }],
        });
      }

      if (body.type === Type.MARKET && body.price !== undefined) {
        return reply.status(400).send({
          success: false,
          error: 'Validation Error',
          details: [{ field: 'price', message: 'MARKET order price must not be specified' }],
        });
      }

      const result = await this.orderService.submitOrder(body);
      return reply.status(201).send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: err.message || 'Failed to submit order',
      });
    }
  };

  public getOrderBook = async (
    request: FastifyRequest<{ Querystring: { depth?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const depthParam = request.query.depth ? parseInt(request.query.depth, 10) : 20;
      const depth = isNaN(depthParam) ? 20 : depthParam;
      const summary = this.orderService.getOrderBookSummary(depth);
      return reply.status(200).send({
        success: true,
        data: summary,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message || 'Failed to get orderbook',
      });
    }
  };

  public getTrades = async (
    request: FastifyRequest<{ Querystring: { limit?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const limitParam = request.query.limit ? parseInt(request.query.limit, 10) : 50;
      const limit = isNaN(limitParam) ? 50 : limitParam;
      const trades = await this.orderService.getRecentTrades(limit);
      return reply.status(200).send({
        success: true,
        data: trades,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message || 'Failed to get trades',
      });
    }
  };

  public getStats = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await this.orderService.getMarketStats();
      return reply.status(200).send({
        success: true,
        data: stats,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message || 'Failed to get stats',
      });
    }
  };

  public getOpenOrders = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const openOrders = await this.orderService.getActiveOrders();
      return reply.status(200).send({
        success: true,
        data: openOrders,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message || 'Failed to get open orders',
      });
    }
  };

  public cancelOrder = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const cancelledOrder = await this.orderService.cancelOrder(id);
      return reply.status(200).send({
        success: true,
        data: cancelledOrder,
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: err.message || 'Failed to cancel order',
      });
    }
  };
}
