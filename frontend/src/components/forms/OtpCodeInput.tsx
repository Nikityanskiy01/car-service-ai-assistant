import { useRef, useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
};

const LENGTH = 6;

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
    .slice(0, LENGTH);
  const activeIndex = Math.min(digits.length, LENGTH - 1);

  function commit(next: string) {
    const normalized = next.replace(/\D/g, '').slice(0, LENGTH);
    onChange(normalized);
    if (normalized.length === LENGTH && normalized !== digits) {
      onComplete?.(normalized);
    }
  }

  return (
    <div
      className={`otp-input ${className}`.trim()}
      data-invalid={ariaInvalid ? 'true' : undefined}
      data-disabled={disabled ? 'true' : undefined}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="otp-input-slots" aria-hidden="true">
        {Array.from({ length: LENGTH }, (_, index) => {
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
        className="otp-input-control"
        value={digits}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        disabled={disabled}
        maxLength={LENGTH}
        pattern="[0-9]*"
        spellCheck={false}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        onChange={(event) => commit(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </div>
  );
}
