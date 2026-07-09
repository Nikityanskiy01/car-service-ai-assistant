import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConsultationStream } from './useConsultationStream';

vi.mock('../../api/client', () => ({
  getCsrfToken: () => null,
}));

describe('useConsultationStream', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches SSE handlers from stream events', async () => {
    const onThinking = vi.fn();
    const onProgress = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const chunks = [
      new TextEncoder().encode('event: thinking\ndata: {"phase":"start"}\n\n'),
      new TextEncoder().encode('event: progress\ndata: {"step":"analysis"}\n\n'),
      new TextEncoder().encode('event: done\ndata: {"status":"COMPLETED"}\n\n'),
    ];
    let idx = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              if (idx >= chunks.length) return { done: true, value: undefined };
              const value = chunks[idx++];
              return { done: false, value };
            },
          }),
        },
      })),
    );

    const { result } = renderHook(() => useConsultationStream());
    await result.current.start({
      sessionId: 'session-1',
      content: 'test',
      guestToken: 'guest-token',
      handlers: { onThinking, onProgress, onDone, onError },
    });

    expect(onThinking).toHaveBeenCalledWith({ phase: 'start' });
    expect(onProgress).toHaveBeenCalledWith({ step: 'analysis' });
    expect(onDone).toHaveBeenCalledWith({ status: 'COMPLETED' });
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports stream aborts via onError without throwing', async () => {
    const onError = vi.fn();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              throw new Error('The operation was aborted.');
            },
          }),
        },
      })),
    );

    const { result } = renderHook(() => useConsultationStream());
    await result.current.start({
      sessionId: 'session-2',
      content: 'test',
      handlers: { onError },
    });

    expect(onError).toHaveBeenCalledWith({
      code: 'STREAM_ABORTED',
      message: 'The operation was aborted.',
    });
  });

  it('returns friendly error when stream response is not ok', async () => {
    const onError = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        body: null,
      })),
    );

    const { result } = renderHook(() => useConsultationStream());
    await result.current.start({
      sessionId: 'session-3',
      content: 'test',
      handlers: { onError },
    });

    expect(onError).toHaveBeenCalledWith({
      message: 'Ошибка подключения к потоку консультации',
      code: 'STREAM_HTTP_ERROR',
      status: 503,
    });
  });
});

