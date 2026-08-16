import type { GuideLegendItem } from '../../../lib/managerGuide';

export function HelpLegend({ items, compact = false }: { items: GuideLegendItem[]; compact?: boolean }) {
  return (
    <ul className={`help-legend${compact ? ' is-compact' : ''}`}>
      {items.map((item) => (
        <li key={item.label} className={item.tone ? `is-${item.tone}` : undefined}>
          {item.tone ? <i aria-hidden="true" /> : null}
          <strong>{item.label}</strong>
          <span>{item.hint}</span>
        </li>
      ))}
    </ul>
  );
}
