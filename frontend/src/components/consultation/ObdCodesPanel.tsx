import { useState } from 'react';
import { formatObdCodesInput, parseObdCodesInput } from '../../features/consultations/obdCodes';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export function ObdCodesPanel({
  currentCodes,
  disabled,
  onApply,
}: {
  currentCodes?: string | null;
  disabled?: boolean;
  onApply: (message: string) => void;
}) {
  const [value, setValue] = useState(currentCodes || '');
  const parsed = parseObdCodesInput(value);

  return (
    <div className="obd-codes-panel">
      <p className="consult-data-label">Коды OBD-II (необязательно)</p>
      <p className="obd-codes-hint">Например: P0300, P0420 — если горит Check Engine и есть коды со сканера.</p>
      <div className="obd-codes-row">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          placeholder="P0300, P0420"
          disabled={disabled}
          aria-label="Коды ошибок OBD-II"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || !parsed.length}
          onClick={() => onApply(`Коды OBD-II: ${formatObdCodesInput(parsed)}`)}
        >
          Добавить
        </Button>
      </div>
      {parsed.length ? (
        <div className="consult-data-chips">
          {parsed.map((code) => (
            <span key={code} className="is-filled">
              {code}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
