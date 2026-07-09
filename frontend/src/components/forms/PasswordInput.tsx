import { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

export function PasswordInput(
  props: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>,
) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="row gap-sm">
      <Input {...props} type={visible ? 'text' : 'password'} />
      <Button type="button" variant="ghost" onClick={() => setVisible((v) => !v)}>
        {visible ? 'Скрыть' : 'Показать'}
      </Button>
    </div>
  );
}
