'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { WSEventEnvelope } from '../types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

export type WSEventCallback = (envelope: WSEventEnvelope) => void;

export function useWebSocket(onEvent?: WSEventCallback) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastSequence, setLastSequence] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setIsConnected(true);
        console.log('⚡ Connected to ByteVox WebSocket stream');
      };

      ws.onmessage = (event) => {
        try {
          const envelope: WSEventEnvelope = JSON.parse(event.data);

          setLastSequence((prevSeq) => {
            if (prevSeq !== null && envelope.sequence > prevSeq + 1) {
              console.warn(
                `⚠️ Sequence gap detected! Previous: ${prevSeq}, Current: ${envelope.sequence}`
              );
            }
            return envelope.sequence;
          });

          if (callbackRef.current) {
            callbackRef.current(envelope);
          }
        } catch (err) {
          console.error('Failed to parse WS event:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log('⚡ Disconnected from WebSocket stream. Reconnecting in 3s...');
        setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.close();
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to initialize WebSocket:', err);
      setTimeout(connect, 3000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected, lastSequence };
}
