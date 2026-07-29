import { useState } from 'react';

export function MasterChecksChecklist({ checks }: { checks: string[] }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  if (!checks.length) return null;

  const toggle = (item: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  return (
    <section className="analysis-list master-checks" aria-label="Что проверит мастер">
      <h4>Что проверит мастер</h4>
      <p className="master-checks-hint">Отметьте пункты, которые хотите обсудить при визите — это для вас, не сохраняется на сервере.</p>
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
