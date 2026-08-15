import { useCallback, useMemo, useRef } from 'react';
import { getCsrfToken } from '../../api/client';
import { parseSseChunk } from './sse';
import { solveAbuseChallenge } from './abusePow';

type StreamHandlers = {
  onThinking?: (payload: unknown) => void;
  onProgress?: (payload: unknown) => void;
  onDone?: (payload: unknown) => void;
  onError?: (payload: unknown) => void;
};

export function useConsultationStream() {
  const controllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const start = useCallback(
    async ({
      sessionId,
      content,
      guestToken,
      handlers,
    }: {
      sessionId: string;
      content: string;
      guestToken?: string | null;
      handlers?: StreamHandlers;
    }) => {
      stop();
      const controller = new AbortController();
      controllerRef.current = controller;
      const headers = new Headers({ 'Content-Type': 'application/json' });
      const csrf = getCsrfToken();
      if (csrf) headers.set('X-CSRF-Token', csrf);
      if (guestToken) headers.set('X-Consultation-Guest-Token', guestToken);
      if (guestToken) {
        const abuseHeaders = await solveAbuseChallenge();
        for (const [key, value] of Object.entries(abuseHeaders)) {
          headers.set(key, value);
        }
      }

      const response = await fetch(`/api/consultations/${sessionId}/messages/stream`, {
        method: 'POST',
        body: JSON.stringify({ content }),
        headers,
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        handlers?.onError?.({
          message: 'Ошибка подключения к потоку консультации',
          code: 'STREAM_HTTP_ERROR',
          status: response.status,
        });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let gotTerminalEvent = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parsed = parseSseChunk(buffer);
          buffer = parsed.rest;
          for (const evt of parsed.events) {
            if (evt.event === 'connected' || evt.event === 'heartbeat') continue;
            if (evt.event === 'thinking') handlers?.onThinking?.(evt.data);
            else if (evt.event === 'progress') handlers?.onProgress?.(evt.data);
            else if (evt.event === 'done') {
              gotTerminalEvent = true;
              handlers?.onDone?.(evt.data);
            } else if (evt.event === 'error') {
              gotTerminalEvent = true;
              handlers?.onError?.(evt.data);
            }
          }
        }
        if (!gotTerminalEvent) {
          handlers?.onError?.({
            code: 'STREAM_INCOMPLETE',
            message: 'Поток ответа завершился без финального события. Попробуйте отправить сообщение снова.',
          });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'Поток консультации прерван';
        handlers?.onError?.({ code: 'STREAM_ABORTED', message });
        return;
      }
    },
    [stop],
  );

  return useMemo(() => ({ start, stop }), [start, stop]);
}
