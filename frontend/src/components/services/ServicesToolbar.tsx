import type { CSSProperties } from 'react';
import { ArrowDownUp, LayoutGrid, Search, X } from 'lucide-react';
import { getAllCategories, getCategoryMeta } from '../../features/services/categoryConfig';
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
  const hasFilters = Boolean(query || category || sort !== 'default');

  function resetFilters() {
    onQueryChange('');
    onCategoryChange(null);
    onSortChange('default');
  }

  return (
    <div className="fm-svc-toolbar">
      <div className="fm-svc-toolbar__top">
        <div className="fm-svc-toolbar__search">
          <Search size={18} aria-hidden="true" className="fm-svc-toolbar__search-icon" />
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
              className="fm-svc-toolbar__clear"
              onClick={() => onQueryChange('')}
              aria-label="Очистить поиск"
            >
              <X size={15} />
            </button>
          ) : null}
        </div>

        <label className="fm-svc-sort">
          <ArrowDownUp size={15} aria-hidden="true" />
          <span className="fm-svc-sort__label">Сортировка</span>
          <select value={sort} onChange={(e) => onSortChange(e.target.value as ServiceSort)} aria-label="Сортировка">
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="fm-svc-toolbar__cats-wrap">
        <div className="fm-svc-cats" role="tablist" aria-label="Категории услуг">
          <button
            type="button"
            role="tab"
            aria-selected={!category}
            className={!category ? 'is-active' : ''}
            style={{ '--cat-accent': 'var(--fm-orange-hot)' } as CSSProperties}
            onClick={() => onCategoryChange(null)}
          >
            <LayoutGrid size={14} aria-hidden="true" className="fm-svc-cats__icon" />
            Все
            <span className="fm-svc-cats__count">{services.length}</span>
          </button>
          {categories.map((cat) => {
            const meta = getCategoryMeta(cat);
            const Icon = meta.icon;
            const count = services.filter((s) => s.category === cat).length;

            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={category === cat}
                className={category === cat ? 'is-active' : ''}
                style={{ '--cat-accent': meta.accent } as CSSProperties}
                onClick={() => onCategoryChange(cat)}
              >
                <Icon size={14} aria-hidden="true" className="fm-svc-cats__icon" />
                {cat}
                <span className="fm-svc-cats__count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="fm-svc-toolbar__footer">
        <p className="fm-svc-toolbar__meta">
          <span className="fm-svc-toolbar__count">{resultCount}</span>
          {resultCount === 1 ? 'услуга' : resultCount >= 2 && resultCount <= 4 ? 'услуги' : 'услуг'}
          {category ? (
            <>
              {' '}
              в <em>{category}</em>
            </>
          ) : null}
          {query ? (
            <>
              {' '}
              по запросу «{query}»
            </>
          ) : null}
        </p>

        {hasFilters ? (
          <button type="button" className="fm-svc-toolbar__reset" onClick={resetFilters}>
            <X size={14} aria-hidden="true" />
            Сбросить
          </button>
        ) : null}
      </div>
    </div>
  );
}
