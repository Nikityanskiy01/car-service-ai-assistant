import type { CSSProperties } from 'react';
import { ArrowDownUp, LayoutGrid, Search, X } from 'lucide-react';
import { getAllCategories, getCategoryMeta } from '../../features/services/categoryConfig';
import type { ServiceItem, ServiceSort } from '../../features/services/types';

interface ServicesToolbarProps {
  services: ServiceItem[];
  query: string;
  category: string | null;
  sort: ServiceSort;
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
  onQueryChange,
  onCategoryChange,
  onSortChange,
}: ServicesToolbarProps) {
  const categories = getAllCategories(services);

  return (
    <div className="fm-works-toolbar">
      <div className="fm-works-toolbar__row">
        <div className="fm-works-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Поиск по услуге, симптому или категории…"
            aria-label="Поиск услуг"
          />
          {query ? (
            <button
              type="button"
              className="fm-works-search-clear"
              onClick={() => onQueryChange('')}
              aria-label="Очистить поиск"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>

        <label className="fm-works-sort">
          <ArrowDownUp size={15} aria-hidden="true" />
          <span className="fm-works-sort__label">Сортировка</span>
          <select value={sort} onChange={(e) => onSortChange(e.target.value as ServiceSort)} aria-label="Сортировка">
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="fm-works-filters" role="tablist" aria-label="Категории услуг">
        <button
          type="button"
          role="tab"
          aria-selected={!category}
          className={`fm-works-filter${!category ? ' is-active' : ''}`}
          onClick={() => onCategoryChange(null)}
        >
          <LayoutGrid size={14} aria-hidden="true" className="fm-works-filter__icon" />
          Все
          <span className="fm-works-filter-count">{services.length}</span>
        </button>
        {categories.map((cat) => {
          const meta = getCategoryMeta(cat);
          const Icon = meta.icon;
          const count = services.filter((s) => s.category === cat).length;
          if (count === 0) return null;

          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={category === cat}
              className={`fm-works-filter${category === cat ? ' is-active' : ''}`}
              style={{ '--filter-accent': meta.accent } as CSSProperties}
              onClick={() => onCategoryChange(cat)}
            >
              <Icon size={14} aria-hidden="true" className="fm-works-filter__icon" />
              {cat}
              <span className="fm-works-filter-count">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
