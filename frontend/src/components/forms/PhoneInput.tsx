import { Input } from '../ui/Input';

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 1) return `+7 (${digits}`;
  if (digits.length <= 4) return `+7 (${digits.slice(1)}`;
  if (digits.length <= 7) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4)}`;
  if (digits.length <= 9) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
}

export function PhoneInput({
  value,
  onChange,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  onChange: (value: string) => void;
}) {
  return (
    <Input
      {...props}
      value={value}
      onChange={(event) => onChange(normalizePhone(event.target.value))}
      inputMode="tel"
      autoComplete="tel"
    />
  );
}
