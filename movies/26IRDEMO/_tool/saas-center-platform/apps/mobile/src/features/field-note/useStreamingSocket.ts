/**
 * WebSocket 연결 훅 — 실시간 STT 스트리밍
 *
 * 프로토콜:
 *   Client → Server: Binary PCM + JSON control (start/pause/resume/finish)
 *   Server → Client: JSON (session_started/partial/final/paused/resumed/finished/error)
 */
import { useRef, useCallback } from 'react';
import { useFieldNotePlatform } from './platform/context';
import type { StreamingServerMessage } from './types';
import { WS_MAX_RECONNECT_ATTEMPTS } from './constants';

type MessageHandler = (msg: StreamingServerMessage) => void;
type DisconnectHandler = (code: number, reason: string) => void;

interface UseStreamingSocketOptions {
  centerId: string;
  onMessage: MessageHandler;
  onDisconnect?: DisconnectHandler;
}

export function useStreamingSocket({
  centerId,
  onMessage,
  onDisconnect,
}: UseStreamingSocketOptions) {
  const { config } = useFieldNotePlatform();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const intentionalCloseRef = useRef(false);

  const connect = useCallback(async () => {
    const token = await config.getAccessToken();
    if (!token) return false;

    // HTTP → WS URL 변환
    const wsBase = config.getApiBaseUrl().replace(/^http/, 'ws');
    const url = `${wsBase}${config.getApiPrefix()}/centers/${centerId}/field-notes/stream?token=${token}`;

    return new Promise<boolean>((resolve) => {
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;
        intentionalCloseRef.current = false;

        ws.onopen = () => {
          reconnectCountRef.current = 0;
          resolve(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as StreamingServerMessage;
            onMessage(data);
          } catch {
            // invalid JSON from server — ignore
          }
        };

        ws.onerror = () => {};

        ws.onclose = (event) => {
          wsRef.current = null;

          if (!intentionalCloseRef.current) {
            onDisconnect?.(event.code, event.reason);
          }

          // 아직 연결 시도 중이었으면 실패로 resolve
          resolve(false);
        };
      } catch {
        resolve(false);
      }
    });
  }, [centerId, config, onMessage, onDisconnect]);

  const sendJSON = useCallback((data: object) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, []);

  const sendAudio = useCallback((buffer: ArrayBuffer) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(buffer);
    }
  }, []);

  const startSession = useCallback(
    (fieldNoteId: string, sampleRate: number = 16000) => {
      sendJSON({ type: 'start', field_note_id: fieldNoteId, sample_rate: sampleRate });
    },
    [sendJSON],
  );

  const pause = useCallback(() => sendJSON({ type: 'pause' }), [sendJSON]);
  const resume = useCallback(() => sendJSON({ type: 'resume' }), [sendJSON]);
  const finish = useCallback(() => {
    sendJSON({ type: 'finish' });
  }, [sendJSON]);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  const isConnected = useCallback(
    () => wsRef.current?.readyState === WebSocket.OPEN,
    [],
  );

  return {
    connect,
    disconnect,
    sendAudio,
    startSession,
    pause,
    resume,
    finish,
    isConnected,
  };
}
