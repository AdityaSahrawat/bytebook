import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { registerOrderRoutes } from './routes/order.routes';
import { OrderController } from './controllers/order.controller';
import { OrderService } from './services/order.service';

export async function buildApp(orderService: OrderService): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: process.env.NODE_ENV === 'development',
  });

  await fastify.register(cors, {
    origin: '*',
  });

  const controller = new OrderController(orderService);
  registerOrderRoutes(fastify, controller);

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'OK', timestamp: new Date().toISOString() };
  });

  return fastify;
}
