/** Извлекает 10 национальных цифр РФ без кода страны. */
export function extractNationalDigits(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (!digits) return '';

  if (digits[0] === '8') {
    digits = `7${digits.slice(1)}`;
  }

  if (digits[0] === '7') {
    digits = digits.slice(1);
  }

  return digits.slice(0, 10);
}

/** Форматирует национальные цифры в +7 (XXX) XXX-XX-XX. */
export function formatPhoneDisplay(nationalDigits: string): string {
  const d = nationalDigits;
  if (!d) return '';

  if (d.length <= 3) return `+7 (${d}`;
  if (d.length <= 6) return `+7 (${d.slice(0, 3)}) ${d.slice(3)}`;
  if (d.length <= 8) return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
}

export function formatPhoneInput(raw: string): string {
  return formatPhoneDisplay(extractNationalDigits(raw));
}

/** Сколько национальных цифр находится левее курсора в отформатированной строке. */
export function countNationalDigitsBefore(value: string, cursor: number): number {
  const digits = extractNationalDigits(value.slice(0, cursor));
  return digits.length;
}

const CURSOR_AFTER_DIGIT = [4, 5, 6, 7, 10, 11, 12, 14, 15, 17, 18, 19] as const;

/** Позиция курсора после N национальных цифр. */
export function nationalDigitIndexToCursor(digitIndex: number, formatted: string): number {
  if (!formatted) return 0;
  const clamped = Math.max(0, Math.min(digitIndex, CURSOR_AFTER_DIGIT.length - 1));
  const pos = CURSOR_AFTER_DIGIT[clamped];
  return Math.min(pos, formatted.length);
}
