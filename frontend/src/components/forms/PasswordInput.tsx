import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Input } from '../ui/Input';

export function PasswordInput({
  className = '',
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false);
  const toggleId = props.id ? `${props.id}-toggle` : undefined;
  const label = visible ? 'Скрыть пароль' : 'Показать пароль';

  return (
    <div className="password-input">
      <Input {...props} className={`${className}`.trim()} type={visible ? 'text' : 'password'} />
      <button
        id={toggleId}
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={18} strokeWidth={2} aria-hidden /> : <Eye size={18} strokeWidth={2} aria-hidden />}
      </button>
    </div>
  );
}
