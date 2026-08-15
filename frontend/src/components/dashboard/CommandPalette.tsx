import { useEffect, useRef, useState } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';
import type { CommandItem } from '../../hooks/useCommandPalette';

type Props = {
  open: boolean;
  query: string;
  items: CommandItem[];
  placeholder?: string;
  onQueryChange: (value: string) => void;
  onSelect: (item: CommandItem) => void;
  onClose: () => void;
};

export function CommandPalette({
  open,
  query,
  items,
  placeholder = 'Куда перейти?',
  onQueryChange,
  onSelect,
  onClose,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'input, button, [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (items.length ? (index + 1) % items.length : 0));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (items.length ? (index - 1 + items.length) % items.length : 0));
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = items[activeIndex];
      if (item) onSelect(item);
    }
  }

  const activeId = items[activeIndex] ? `command-option-${items[activeIndex].id}` : undefined;

  return (
    <div className="command-palette-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Командная палитра"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="command-palette-input-row">
          <Search size={18} aria-hidden />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={placeholder}
            aria-label="Поиск по разделам и действиям"
            aria-controls="command-palette-list"
            aria-activedescendant={activeId}
          />
          <kbd>Esc</kbd>
        </div>
        <ul className="command-palette-list" id="command-palette-list" ref={listRef} role="listbox">
          {items.length ? (
            items.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  id={`command-option-${item.id}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  data-active={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => onSelect(item)}
                >
                  <span>{item.label}</span>
                  <em>{item.group}</em>
                  {index === activeIndex ? <CornerDownLeft size={14} aria-hidden /> : null}
                </button>
              </li>
            ))
          ) : (
            <li className="command-palette-empty">Ничего не найдено</li>
          )}
        </ul>
        <footer className="command-palette-footer muted">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> навигация
          </span>
          <span>
            <kbd>Enter</kbd> открыть
          </span>
          <span>
            <kbd>Ctrl</kbd>+<kbd>K</kbd> палитра
          </span>
        </footer>
      </div>
    </div>
  );
}
