const OBD_PATTERN = /\b([PCBU][0-3][0-9A-F]{3})\b/gi;

export function parseObdCodesInput(text: string): string[] {
  const found = new Set<string>();
  const re = new RegExp(OBD_PATTERN.source, 'gi');
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    found.add(match[1].toUpperCase());
  }
  return [...found].sort();
}

export function formatObdCodesInput(codes: string[]): string {
  return parseObdCodesInput(codes.join(', ')).join(', ');
}
