import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { WSEventEnvelope, WSEventType } from '../types';

export class WebSocketServerManager {
  private wss: WebSocketServer;
  private sequence: number = 0;

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.init();
  }

  private init(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('⚡ WebSocket client connected');

      ws.on('close', () => {
        console.log('⚡ WebSocket client disconnected');
      });

      ws.on('error', (err) => {
        console.error('⚡ WebSocket error:', err.message);
      });
    });
  }

  /**
   * Broadcast an event envelope to all connected WebSocket clients.
   */
  public broadcast<T>(type: WSEventType, data: T): WSEventEnvelope<T> {
    this.sequence += 1;
    const envelope: WSEventEnvelope<T> = {
      sequence: this.sequence,
      type,
      timestamp: new Date().toISOString(),
      data,
    };

    const payload = JSON.stringify(envelope);

    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }

    return envelope;
  }

  public getSequence(): number {
    return this.sequence;
  }
}
