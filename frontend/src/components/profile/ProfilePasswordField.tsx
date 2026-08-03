import type { LucideIcon } from 'lucide-react';
import { PasswordInput } from '../forms/PasswordInput';

type Props = {
  id: string;
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
};

export function ProfilePasswordField({
  id,
  icon: Icon,
  value,
  onChange,
  placeholder,
  autoComplete,
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
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
