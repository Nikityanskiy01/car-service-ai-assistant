import type { ObdCodeInterpretation } from '../../types/consultation';

export function ObdCodesSummary({ items }: { items: ObdCodeInterpretation[] }) {
  if (!items.length) return null;
  return (
    <section className="analysis-list obd-summary" aria-label="Расшифровка кодов OBD">
      <h4>Коды ошибок OBD-II</h4>
      <ul>
        {items.map((item) => (
          <li key={item.code}>
            <div className="obd-code-head">
              <strong>{item.code}</strong>
              <span>{item.title}</span>
            </div>
            <p className="obd-code-plain">{item.plain}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
