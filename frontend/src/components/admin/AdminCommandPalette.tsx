import { Search } from 'lucide-react';
import type { CommandItem } from '../../hooks/useAdminCommandPalette';

type Props = {
  open: boolean;
  query: string;
  items: CommandItem[];
  onQueryChange: (value: string) => void;
  onSelect: (item: CommandItem) => void;
  onClose: () => void;
};

export function AdminCommandPalette({ open, query, items, onQueryChange, onSelect, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="command-palette-backdrop" role="presentation" onClick={onClose}>
      <div
        className="command-palette"
        role="dialog"
        aria-label="Командная палитра"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="command-palette-input-row">
          <Search size={18} aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Поиск разделов админки…"
            aria-label="Поиск"
          />
          <kbd>Ctrl+K</kbd>
        </div>
        <ul className="command-palette-list">
          {items.length ? (
            items.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => onSelect(item)}>
                  <span>{item.label}</span>
                  <em>{item.group}</em>
                </button>
              </li>
            ))
          ) : (
            <li className="command-palette-empty">Ничего не найдено</li>
          )}
        </ul>
      </div>
    </div>
  );
}
