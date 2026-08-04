import { buildApp } from './app';
import { MatchingEngine } from './engine/matchingEngine';
import { OrderRepository } from './repositories/order.repository';
import { OrderService } from './services/order.service';
import { WebSocketServerManager } from './websocket/wsServer';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

async function bootstrap() {
  try {
    const matchingEngine = new MatchingEngine();
    const orderRepository = new OrderRepository();
    const orderService = new OrderService(matchingEngine, orderRepository);

    // Hydrate OrderBook from DB on startup
    await orderService.hydrateOnBoot();

    const app = await buildApp(orderService);

    // Attach WebSocket server to Fastify HTTP server
    const wsServer = new WebSocketServerManager(app.server);
    orderService.setWebSocketServer(wsServer);

    await app.listen({ port: PORT, host: '0.0.0.0' });

    console.log(`⚡ ByteVox Fastify Backend Server running on http://localhost:${PORT}`);
    console.log(`⚡ WebSocket Server listening on ws://localhost:${PORT}/ws`);
  } catch (err) {
    console.error('❌ Failed to start Fastify server:', err);
    process.exit(1);
  }
}

bootstrap();
