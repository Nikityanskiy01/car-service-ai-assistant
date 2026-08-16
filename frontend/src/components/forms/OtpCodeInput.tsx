import { useRef, useState, type InputHTMLAttributes, type PointerEvent } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
};

export const OTP_LENGTH = 6;

/** Нормализует ввод с телефона: каретка в начале и select-all не должны ломать порядок цифр. */
export function normalizeOtpDigits(previous: string, incoming: string): string {
  const prev = previous.replace(/\D/g, '').slice(0, OTP_LENGTH);
  const next = incoming.replace(/\D/g, '').slice(0, OTP_LENGTH);

  if (next === prev) return next;

  if (prev.length > 0 && next.length === prev.length + 1 && next.endsWith(prev)) {
    return (prev + next[0]).slice(0, OTP_LENGTH);
  }

  if (prev.length > 1 && next.length === 1) {
    return (prev + next).slice(0, OTP_LENGTH);
  }

  return next;
}

function pinCaretToEnd(el: HTMLInputElement) {
  const len = el.value.length;
  if (el.selectionStart === len && el.selectionEnd === len) return;
  try {
    el.setSelectionRange(len, len);
  } catch {
    /* type=number и часть WebKit-сборок не умеют selection */
  }
}

export function OtpCodeInput({
  id,
  name,
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus,
  className = '',
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  'aria-label': ariaLabel,
  ...rest
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const digits = String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, OTP_LENGTH);
  const activeIndex = Math.min(digits.length, OTP_LENGTH - 1);

  function commit(next: string) {
    const normalized = next.replace(/\D/g, '').slice(0, OTP_LENGTH);
    onChange(normalized);
    if (normalized.length === OTP_LENGTH && normalized !== digits) {
      onComplete?.(normalized);
    }
  }

  function pinSoon(el: HTMLInputElement) {
    pinCaretToEnd(el);
    requestAnimationFrame(() => {
      if (inputRef.current) pinCaretToEnd(inputRef.current);
    });
  }

  function focusAndPin() {
    const el = inputRef.current;
    if (!el || disabled) return;
    el.focus({ preventScroll: true });
    pinSoon(el);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    if (event.target !== inputRef.current) {
      event.preventDefault();
    }
    focusAndPin();
  }

  return (
    <div
      className={`otp-input ${className}`.trim()}
      data-invalid={ariaInvalid ? 'true' : undefined}
      data-disabled={disabled ? 'true' : undefined}
      onPointerDown={handlePointerDown}
    >
      <div className="otp-input-slots" aria-hidden="true">
        {Array.from({ length: OTP_LENGTH }, (_, index) => {
          const filled = Boolean(digits[index]);
          const active = focused && !disabled && index === activeIndex;
          return (
            <span
              key={index}
              className={`otp-input-slot${filled ? ' is-filled' : ''}${active ? ' is-active' : ''}`}
            >
              {digits[index] ?? ''}
            </span>
          );
        })}
      </div>
      <input
        {...rest}
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        className="otp-input-control"
        value={digits}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoCapitalize="none"
        autoCorrect="off"
        autoFocus={autoFocus}
        disabled={disabled}
        maxLength={OTP_LENGTH}
        pattern="[0-9]*"
        enterKeyHint="done"
        spellCheck={false}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        onChange={(event) => {
          commit(normalizeOtpDigits(digits, event.target.value));
          requestAnimationFrame(() => {
            if (inputRef.current) pinCaretToEnd(inputRef.current);
          });
        }}
        onFocus={(event) => {
          setFocused(true);
          pinSoon(event.currentTarget);
        }}
        onBlur={() => setFocused(false)}
        onSelect={(event) => pinCaretToEnd(event.currentTarget)}
      />
    </div>
  );
}
