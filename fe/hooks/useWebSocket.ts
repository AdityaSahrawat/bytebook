'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { WSEventEnvelope } from '../types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

export type WSEventCallback = (envelope: WSEventEnvelope) => void;

export function useWebSocket(onEvent?: WSEventCallback) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastSequence, setLastSequence] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  const connect = useCallback(() => {
    // Clear any pending reconnect timer
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // Close existing socket if open
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

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

      ws.onclose = (evt) => {
        setIsConnected(false);
        // Only attempt reconnect if closed cleanly by server/drop, not by unmount
        if (evt.wasClean === false || evt.code !== 1000) {
          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      ws.onerror = (err) => {
        if (ws.readyState === WebSocket.OPEN) {
          console.error('WebSocket error:', err);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to initialize WebSocket:', err);
      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, 3000);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        // Code 1000 = Normal Closure on unmount
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { isConnected, lastSequence };
}
