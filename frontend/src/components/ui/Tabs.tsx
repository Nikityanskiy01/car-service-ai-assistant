export interface TabItem {
  id: string;
  label: string;
}

export function Tabs({
  items,
  value,
  onChange,
  className = '',
}: {
  items: TabItem[];
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  return (
    <div className={`tabs ${className}`.trim()} role="tablist">
      {items.map((item) => {
        const selected = value === item.id;
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            id={`tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`tabpanel-${item.id}`}
            className={`tab ${selected ? 'tab-active' : ''}`}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
