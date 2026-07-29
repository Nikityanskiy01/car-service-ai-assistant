import { Search, SlidersHorizontal, X } from 'lucide-react';
import { getAllCategories } from '../../features/services/categoryConfig';
import type { ServiceItem, ServiceSort } from '../../features/services/types';

interface ServicesToolbarProps {
  services: ServiceItem[];
  query: string;
  category: string | null;
  sort: ServiceSort;
  resultCount: number;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: string | null) => void;
  onSortChange: (value: ServiceSort) => void;
}

const sortOptions: { value: ServiceSort; label: string }[] = [
  { value: 'default', label: 'По умолчанию' },
  { value: 'price-asc', label: 'Сначала дешевле' },
  { value: 'price-desc', label: 'Сначала дороже' },
  { value: 'title', label: 'По названию' },
];

export function ServicesToolbar({
  services,
  query,
  category,
  sort,
  resultCount,
  onQueryChange,
  onCategoryChange,
  onSortChange,
}: ServicesToolbarProps) {
  const categories = getAllCategories(services);

  return (
    <div className="fm-svc-toolbar">
      <div className="fm-svc-toolbar__search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Поиск по услуге, симптому или категории…"
          aria-label="Поиск услуг"
        />
        {query ? (
          <button type="button" className="fm-svc-toolbar__clear" onClick={() => onQueryChange('')} aria-label="Очистить поиск">
            <X size={16} />
          </button>
        ) : null}
      </div>

      <div className="fm-svc-toolbar__filters">
        <div className="fm-svc-cats" role="tablist" aria-label="Категории услуг">
          <button
            type="button"
            role="tab"
            aria-selected={!category}
            className={!category ? 'is-active' : ''}
            onClick={() => onCategoryChange(null)}
          >
            Все
            <span>{services.length}</span>
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={category === cat}
              className={category === cat ? 'is-active' : ''}
              onClick={() => onCategoryChange(cat)}
            >
              {cat}
              <span>{services.filter((s) => s.category === cat).length}</span>
            </button>
          ))}
        </div>

        <label className="fm-svc-sort">
          <SlidersHorizontal size={15} aria-hidden="true" />
          <select value={sort} onChange={(e) => onSortChange(e.target.value as ServiceSort)} aria-label="Сортировка">
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="fm-svc-toolbar__meta">
        Найдено: <strong>{resultCount}</strong>
        {category ? <> в категории «{category}»</> : null}
        {query ? <> по запросу «{query}»</> : null}
      </p>
    </div>
  );
}
