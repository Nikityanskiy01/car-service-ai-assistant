import { ArrowRight, Clock, Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { getCategoryMeta } from '../../features/services/categoryConfig';
import { prefillService } from '../../features/services/prefill';
import type { ServiceItem } from '../../features/services/types';
import { estimateDuration, isFeaturedService, resolveServiceImage } from '../../features/services/utils';

interface ServiceCardProps {
  item: ServiceItem;
  variant?: 'default' | 'compact' | 'featured';
  index?: number;
}

export function ServiceCard({ item, variant = 'default', index = 0 }: ServiceCardProps) {
  const meta = getCategoryMeta(item.category);
  const Icon = meta.icon;
  const featured = isFeaturedService(item);
  const image = resolveServiceImage(item);
  const duration = estimateDuration(item.category);

  const cardClass = [
    'fm-svc-card',
    variant === 'featured' ? 'fm-svc-card--featured' : '',
    variant === 'compact' ? 'fm-svc-card--compact' : '',
    featured ? 'fm-svc-card--ai' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const ctaTo = featured ? '/consult' : '/booking';
  const ctaLabel = featured ? 'Начать консультацию' : 'Записаться';

  function handleClick() {
    if (!featured) prefillService(item);
  }

  return (
    <article
      className={cardClass}
      style={{ '--svc-accent': meta.accent, '--svc-delay': `${index * 60}ms` } as CSSProperties}
    >
      <div className="fm-svc-card__media">
        <img src={image} alt={item.title} loading="lazy" />
        <span className="fm-svc-card__icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        {featured ? (
          <span className="fm-svc-card__badge">
            <Sparkles size={12} aria-hidden="true" />
            Популярно
          </span>
        ) : null}
      </div>

      <div className="fm-svc-card__body">
        <div className="fm-svc-card__top">
          {item.category ? <span className="fm-tag">{item.category}</span> : null}
          <span className="fm-svc-card__time">
            <Clock size={13} aria-hidden="true" />
            {duration}
          </span>
        </div>

        <h3 className="fm-svc-card__title">{item.title}</h3>
        <p className="fm-svc-card__desc">{item.description || 'Описание уточняется у мастера.'}</p>

        <div className="fm-svc-card__footer">
          <span className="fm-price">{item.price || 'Стоимость по осмотру'}</span>
          <Link to={ctaTo} className="fm-svc-card__cta" onClick={handleClick}>
            {ctaLabel}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
