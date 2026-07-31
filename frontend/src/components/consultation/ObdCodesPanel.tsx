import { Gauge } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { formatObdCodesInput, parseObdCodesInput } from '../../features/consultations/obdCodes';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

function codesCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} код в диагностике`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} кода в диагностике`;
  return `${count} кодов в диагностике`;
}

export function ObdCodesPanel({
  currentCodes,
  disabled,
  onApply,
}: {
  currentCodes?: string | null;
  disabled?: boolean;
  onApply: (message: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [pendingCodes, setPendingCodes] = useState<string[]>([]);
  const draftCodes = parseObdCodesInput(draft);
  const savedCodes = parseObdCodesInput(currentCodes || '');

  useEffect(() => {
    if (!currentCodes) return;
    const serverCodes = parseObdCodesInput(currentCodes);
    setPendingCodes((prev) => prev.filter((code) => !serverCodes.includes(code)));
  }, [currentCodes]);

  const appliedCodes = useMemo(
    () => [...new Set([...savedCodes, ...pendingCodes])].sort(),
    [savedCodes, pendingCodes],
  );

  function applyDraft() {
    if (!draftCodes.length || disabled) return;
    setPendingCodes((prev) => [...new Set([...prev, ...draftCodes])].sort());
    onApply(`Коды OBD-II: ${formatObdCodesInput(draftCodes)}`);
    setDraft('');
  }

  return (
    <section className="obd-codes-card" aria-label="Коды OBD-II">
      <header className="obd-codes-header">
        <div className="obd-codes-title">
          <Gauge size={18} strokeWidth={2.25} aria-hidden />
          <h3>Коды OBD-II</h3>
        </div>
        <span className="obd-codes-badge">Необязательно</span>
      </header>

      <p className="obd-codes-hint">
        Если горит Check Engine — укажите коды со сканера, например P0300 или P0420.
      </p>

      {appliedCodes.length ? (
        <div className="obd-codes-applied">
          <p className="obd-codes-applied-label">{codesCountLabel(appliedCodes.length)}</p>
          <div className="obd-codes-chip-list">
            {appliedCodes.map((code) => (
              <span
                key={code}
                className={`obd-code-chip${pendingCodes.includes(code) ? ' is-pending' : ''}`}
              >
                {code}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="obd-codes-empty">Коды не указаны — можно добавить в любой момент</p>
      )}

      <div className="obd-codes-compose">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              applyDraft();
            }
          }}
          placeholder="P0300, P0420"
          disabled={disabled}
          aria-label="Коды ошибок OBD-II"
        />
        <Button
          type="button"
          variant="primary"
          className="obd-codes-submit-btn"
          disabled={disabled || !draftCodes.length}
          onClick={applyDraft}
        >
          Отправить в чат
        </Button>
      </div>
    </section>
  );
}
