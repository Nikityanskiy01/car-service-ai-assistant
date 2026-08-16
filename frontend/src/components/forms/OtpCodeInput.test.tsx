import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { normalizeOtpDigits, OtpCodeInput } from './OtpCodeInput';
import { FormField } from './FormField';

function Harness({
  onChange,
  onComplete,
}: {
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <FormField label="Код из приложения" htmlFor="otp">
      <OtpCodeInput
        id="otp"
        value={value}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
        onComplete={onComplete}
      />
    </FormField>
  );
}

describe('normalizeOtpDigits', () => {
  it('оставляет обычный ввод и вставку кода как есть', () => {
    expect(normalizeOtpDigits('', '1')).toBe('1');
    expect(normalizeOtpDigits('12', '123')).toBe('123');
    expect(normalizeOtpDigits('', '123456')).toBe('123456');
    expect(normalizeOtpDigits('123', '12')).toBe('12');
  });

  it('цифру в начале трактует как ввод в конец', () => {
    expect(normalizeOtpDigits('123', '9123')).toBe('1239');
  });

  it('одну цифру вместо всего кода дописывает, а не затирает', () => {
    expect(normalizeOtpDigits('123', '9')).toBe('1239');
  });
});

describe('OtpCodeInput', () => {
  it('принимает 6 цифр и вызывает onComplete', async () => {
    const onChange = vi.fn();
    const onComplete = vi.fn();
    render(<Harness onChange={onChange} onComplete={onComplete} />);
    await userEvent.type(screen.getByLabelText('Код из приложения'), '123456');
    expect(onChange).toHaveBeenLastCalledWith('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('отбрасывает буквы и обрезает длину', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Код из приложения'), '12ab34567');
    expect(onChange.mock.calls[onChange.mock.calls.length - 1]?.[0]).toBe('123456');
  });

  it('не переносит ввод с конца слотов в первую ячейку', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText('Код из приложения');
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.change(input, { target: { value: '312' } });
    expect(onChange).toHaveBeenLastCalledWith('123');
  });
});
