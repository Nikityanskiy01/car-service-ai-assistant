import { describe, expect, it } from 'vitest';
import { parseSseChunk } from './sse';

describe('parseSseChunk', () => {
  it('parses multiple events and keeps rest buffer', () => {
    const input =
      'event: thinking\ndata: {"phase":"start"}\n\n' +
      'event: progress\ndata: {"step":"extract"}\n\n' +
      'event: done\ndata: {"ok":true}\n\nevent: error\ndata: {"message":"x"}';

    const parsed = parseSseChunk(input);

    expect(parsed.events).toHaveLength(3);
    expect(parsed.events[0]).toEqual({ event: 'thinking', data: { phase: 'start' } });
    expect(parsed.events[1]).toEqual({ event: 'progress', data: { step: 'extract' } });
    expect(parsed.events[2]).toEqual({ event: 'done', data: { ok: true } });
    expect(parsed.rest).toBe('event: error\ndata: {"message":"x"}');
  });

  it('keeps text payload when json parse fails', () => {
    const parsed = parseSseChunk('event: error\ndata: plain text error\n\n');
    expect(parsed.events).toEqual([{ event: 'error', data: 'plain text error' }]);
    expect(parsed.rest).toBe('');
  });

  it('supports CRLF chunks and multiline data blocks', () => {
    const raw = 'event: progress\r\ndata: {"phase":"extracting"}\r\n\r\nevent: heartbeat\r\ndata: {"ts":1}\r\n\r\n';
    const parsed = parseSseChunk(raw);
    expect(parsed.events).toEqual([
      { event: 'progress', data: { phase: 'extracting' } },
      { event: 'heartbeat', data: { ts: 1 } },
    ]);
  });
});

