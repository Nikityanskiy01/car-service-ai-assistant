import { useState } from 'react';

const DEFAULT_HINT =
  'Отметьте пункты, которые хотите обсудить при записи. Это для вас, на сервер не пишется.';

export function MasterChecksChecklist({
  checks,
  title = 'Что проверит мастер',
  hint,
}: {
  checks: string[];
  title?: string;
  hint?: string | null;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  if (!checks.length) return null;
  const resolvedHint = hint === undefined ? DEFAULT_HINT : hint;

  const toggle = (item: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  return (
    <section className="analysis-list master-checks" aria-label={title}>
      <h4>{title}</h4>
      {resolvedHint ? <p className="master-checks-hint">{resolvedHint}</p> : null}
      <ul>
        {checks.slice(0, 8).map((check) => {
          const id = `check-${check.slice(0, 40)}`;
          const isOn = checked.has(check);
          return (
            <li key={check}>
              <label htmlFor={id} className={isOn ? 'is-checked' : undefined}>
                <input id={id} type="checkbox" checked={isOn} onChange={() => toggle(check)} />
                <span>{check}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
