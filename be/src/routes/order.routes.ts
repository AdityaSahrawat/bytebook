import { FastifyInstance } from 'fastify';
import { OrderController } from '../controllers/order.controller';
import { CreateOrderDTO } from '../types';

export function registerOrderRoutes(fastify: FastifyInstance, controller: OrderController) {
  fastify.post<{ Body: CreateOrderDTO }>('/api/orders', controller.createOrder);
  fastify.get<{ Querystring: { depth?: string } }>('/api/orderbook', controller.getOrderBook);
  fastify.get<{ Querystring: { limit?: string } }>('/api/trades', controller.getTrades);
  fastify.get('/api/stats', controller.getStats);
  fastify.get('/api/orders/open', controller.getOpenOrders);
  fastify.delete<{ Params: { id: string } }>('/api/orders/:id', controller.cancelOrder);
}
