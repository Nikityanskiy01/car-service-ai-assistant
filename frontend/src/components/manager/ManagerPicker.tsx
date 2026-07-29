import { useEffect, useState } from 'react';
import { listStaffManagers } from '../../api/dashboard';
import { Select } from '../ui/Select';

type ManagerOption = { id: string; fullName: string };

type Props = {
  value?: string;
  onChange: (managerId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
};

export function ManagerPicker({ value, onChange, placeholder = 'Выберите менеджера', disabled, allowEmpty }: Props) {
  const [options, setOptions] = useState<ManagerOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listStaffManagers()
      .then((data) => setOptions(data.items))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Select
      className="manager-picker"
      value={value || ''}
      disabled={disabled || loading}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Менеджер"
    >
      {allowEmpty ? <option value="">{placeholder}</option> : null}
      {options.map((m) => (
        <option key={m.id} value={m.id}>
          {m.fullName}
        </option>
      ))}
    </Select>
  );
}
