import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConsultationStream } from './useConsultationStream';

vi.mock('../../api/client', () => ({
  getCsrfToken: () => null,
}));

vi.mock('./abusePow', () => ({
  solveAbuseChallenge: vi.fn(async () => ({
    'X-Abuse-Nonce': 'nonce',
    'X-Abuse-Issued': '1',
    'X-Abuse-Difficulty': '4',
    'X-Abuse-Sig': 'sig',
    'X-Abuse-Solution': '0',
  })),
}));

describe('useConsultationStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(fetch).toHaveBeenCalledWith(
      '/api/consultations/session-1/messages/stream',
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    const sent = fetch.mock.calls[0][1].headers;
    expect(sent.get('X-Abuse-Nonce')).toBe('nonce');
    expect(sent.get('X-Consultation-Guest-Token')).toBe('guest-token');
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

