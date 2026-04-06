/**
 * Должно совпадать с backend/src/modules/contact/contact.service.js
 * @param {string} raw
 */
export function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 11 && d[0] === '8') d = `7${d.slice(1)}`;
  if (d.length === 10) d = `7${d}`;
  return d;
}

/** Плейсхолдер и целевой шаблон для полей телефона (РФ). */
export const PHONE_INPUT_PLACEHOLDER = '+7 (999) 000-00-00';

/**
 * РФ 7XXXXXXXXXX (11 цифр) или международный 10–15 цифр.
 * @param {string} digits
 */
export function isValidPhoneDigits(digits) {
  if (!digits || digits.length < 10 || digits.length > 15) return false;
  if (!/^\d+$/.test(digits)) return false;
  if (digits.length === 11 && digits[0] === '7') return true;
  return digits.length >= 10 && digits.length <= 15;
}

/** @param {string} raw */
export function isValidPhoneInput(raw) {
  return isValidPhoneDigits(normalizePhone(raw));
}

/** @param {string} str */
function digitsOnly(str) {
  return String(str || '').replace(/\D/g, '');
}

/**
 * Красивое отображение уже введённого / сохранённого номера (без частичного ввода).
 * @param {string} raw
 */
export function formatPhonePretty(raw) {
  const s = digitsOnly(raw);
  if (!s) return '';
  if (s.length === 11 && s[0] === '7') {
    return `+7 (${s.slice(1, 4)}) ${s.slice(4, 7)}-${s.slice(7, 9)}-${s.slice(9)}`;
  }
  if (s.length === 10) {
    return `+7 (${s.slice(0, 3)}) ${s.slice(3, 6)}-${s.slice(6, 8)}-${s.slice(8)}`;
  }
  return `+${s}`;
}

/**
 * Международный номер при вводе: до 15 цифр после «+».
 * @param {string} d
 */
function formatInternationalTyping(d) {
  const capped = d.slice(0, 15);
  return capped ? `+${capped}` : '';
}

/**
 * Российский номер при вводе: +7 (XXX) XXX-XX-XX.
 * @param {string} d — только цифры от пользователя
 */
function formatRussianTyping(d) {
  let x = d;
  if (x[0] === '8') x = `7${x.slice(1)}`;
  else if (x[0] === '9') x = `7${x}`;
  x = x.slice(0, 11);
  if (x[0] !== '7') return formatInternationalTyping(d);
  const nat = x.slice(1);
  const a = nat.slice(0, 3);
  const b = nat.slice(3, 6);
  const c = nat.slice(6, 8);
  const e = nat.slice(8, 10);
  let out = '+7';
  if (a.length === 0) return out;
  out += ` (${a}`;
  if (a.length < 3) return out;
  out += ')';
  if (b.length === 0) return out;
  out += ` ${b}`;
  if (b.length < 3) return out;
  out += '-';
  out += c;
  if (c.length < 2) return out;
  out += '-';
  out += e;
  return out;
}

/**
 * @param {string} d — только цифры
 */
function useRussianTypingMask(d) {
  if (!d) return true;
  const c0 = d[0];
  if (c0 === '8') return true;
  if (c0 === '7') return d.length <= 11;
  if (c0 === '9') return d.length <= 10;
  return false;
}

/**
 * Строка для поля ввода: маска РФ или «+» и цифры для остальных стран.
 * @param {string} raw
 */
export function formatPhoneInputDisplay(raw) {
  const s = String(raw || '');
  const d = digitsOnly(s);
  if (!d) {
    return s.includes('+') ? '+' : '';
  }
  if (useRussianTypingMask(d)) return formatRussianTyping(d);
  return formatInternationalTyping(d);
}

/**
 * @param {string} formatted
 * @param {number} digitCount — сколько цифр должно быть слева от каретки
 */
function caretAfterDigitCount(formatted, digitCount) {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (/\d/.test(formatted[i])) {
      seen += 1;
      if (seen >= digitCount) return i + 1;
    }
  }
  return formatted.length;
}

/**
 * Живое форматирование телефона при вводе (РФ + международные 10–15 цифр).
 * Повторный вызов на том же input безопасен.
 * @param {HTMLInputElement | null | undefined} input
 * @returns {() => void} снять обработчики
 */
export function attachPhoneInputMask(input) {
  if (!input || input.tagName !== 'INPUT') return () => {};
  if (input.dataset.phoneMaskBound === '1') return () => {};
  input.dataset.phoneMaskBound = '1';

  const apply = () => {
    const raw = input.value;
    const sel = input.selectionStart ?? raw.length;
    const digitsLeft = raw.slice(0, sel).replace(/\D/g, '').length;
    const next = formatPhoneInputDisplay(raw);
    if (next === raw) return;
    input.value = next;
    const pos = caretAfterDigitCount(next, digitsLeft);
    try {
      input.setSelectionRange(pos, pos);
    } catch {
      /* ignore */
    }
  };

  input.addEventListener('input', apply);
  if (input.value) apply();

  return () => {
    input.removeEventListener('input', apply);
    delete input.dataset.phoneMaskBound;
  };
}
