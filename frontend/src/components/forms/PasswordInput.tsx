import { useState } from 'react';
import { Input } from '../ui/Input';

export function PasswordInput({
  className = '',
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false);
  const toggleId = props.id ? `${props.id}-toggle` : undefined;

  return (
    <div className="password-input">
      <Input {...props} className={`${className}`.trim()} type={visible ? 'text' : 'password'} />
      <button
        id={toggleId}
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
        tabIndex={-1}
      >
        {visible ? 'Скрыть' : 'Показать'}
      </button>
    </div>
  );
}
