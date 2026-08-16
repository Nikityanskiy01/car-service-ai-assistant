import { useRef, type ChangeEvent } from 'react';
import {
  countNationalDigitsBefore,
  formatPhoneInput,
  nationalDigitIndexToCursor,
} from '../../lib/formatPhone';

export function PhoneInput({
  value,
  onChange,
  placeholder = '+7 (999) 000-00-00',
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const displayValue = formatPhoneInput(value);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const cursor = input.selectionStart ?? 0;
    const digitsBefore = countNationalDigitsBefore(input.value, cursor);
    const formatted = formatPhoneInput(input.value);

    onChange(formatted);

    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      const nextCursor = nationalDigitIndexToCursor(digitsBefore, formatted);
      el.setSelectionRange(nextCursor, nextCursor);
    });
  }

  return (
    <input
      {...props}
      ref={inputRef}
      className={className ?? 'input'}
      value={displayValue}
      placeholder={placeholder}
      onChange={handleChange}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
    />
  );
}
