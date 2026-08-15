import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OtpCodeInput } from './OtpCodeInput';
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
});
