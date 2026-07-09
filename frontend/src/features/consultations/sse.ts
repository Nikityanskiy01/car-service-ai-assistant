export interface SseEvent<T = unknown> {
  event: string;
  data: T | null;
}

export function parseSseChunk(buffer: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = [];
  const normalized = buffer.replace(/\r\n/g, '\n');
  const blocks = normalized.split('\n\n');
  const rest = blocks.pop() || '';

  for (const block of blocks) {
    const lines = block.split('\n');
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    const dataRaw = dataLines.join('\n');
    let data: unknown = null;
    if (dataRaw) {
      try {
        data = JSON.parse(dataRaw);
      } catch {
        data = dataRaw;
      }
    }
    events.push({ event, data });
  }

  return { events, rest };
}
