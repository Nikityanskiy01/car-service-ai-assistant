import type { LucideIcon } from 'lucide-react';
import { PasswordInput } from '../forms/PasswordInput';

type Props = {
  id: string;
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
};

export function ProfilePasswordField({
  id,
  icon: Icon,
  value,
  onChange,
  placeholder,
  autoComplete,
  required = false,
  ...rest
}: Props) {
  return (
    <div className="profile-password-field">
      <span className="profile-password-field-icon" aria-hidden>
        <Icon size={16} strokeWidth={2} />
      </span>
      <PasswordInput
        id={id}
        className="profile-password-field-input"
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </div>
  );
}
