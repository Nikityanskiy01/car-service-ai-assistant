import { ArrowRight, MessageSquare } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllCategories } from '../../features/services/categoryConfig';
import { serviceHighlights } from '../../features/services/data';
import type { ServiceItem } from '../../features/services/types';
import { isFeaturedService } from '../../features/services/utils';
import { ServiceCard } from './ServiceCard';

interface ServicesShowcaseProps {
  services: ServiceItem[];
}

export function ServicesShowcase({ services }: ServicesShowcaseProps) {
  const categories = useMemo(() => getAllCategories(services), [services]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const featured = services.find(isFeaturedService);
  const filtered = activeCategory ? services.filter((s) => s.category === activeCategory) : services;
  const preview = filtered.filter((s) => !isFeaturedService(s)).slice(0, 5);

  return (
    <section className="fm-section fm-svc-showcase" aria-labelledby="services-heading">
      <div className="fm-svc-showcase__head">
        <div>
          <p className="fm-pill">
            <MessageSquare size={14} aria-hidden="true" />
            Каталог работ
          </p>
          <h2 id="services-heading">Услуги автосервиса</h2>
          <p className="fm-svc-showcase__lead">
            От диагностики до капитального ремонта — выберите услугу и запишитесь онлайн. Не уверены в причине?
            Начните с бесплатной ИИ-консультации.
          </p>
        </div>
        <Link className="fm-btn fm-btn-outline" to="/services">
          Все {services.length} услуг
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>

      <div className="fm-svc-highlights">
        {serviceHighlights.map((item) => (
          <div key={item.label} className="fm-svc-highlight">
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="fm-svc-cats fm-svc-cats--wrap" role="tablist" aria-label="Фильтр категорий на главной">
        <button
          type="button"
          role="tab"
          aria-selected={!activeCategory}
          className={!activeCategory ? 'is-active' : ''}
          onClick={() => setActiveCategory(null)}
        >
          Все
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={activeCategory === cat}
            className={activeCategory === cat ? 'is-active' : ''}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="fm-svc-showcase__grid">
        {featured ? <ServiceCard item={featured} variant="featured" /> : null}
        {preview.map((item, i) => (
          <ServiceCard key={item.id} item={item} variant="compact" index={i} />
        ))}
      </div>
    </section>
  );
}
