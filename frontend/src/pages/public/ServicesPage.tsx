import { CalendarCheck, ClipboardList, MapPin, MessageSquare, Phone, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ServiceCard } from '../../components/services/ServiceCard';
import { ServicesToolbar } from '../../components/services/ServicesToolbar';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { Reveal } from '../../components/ui/Reveal';
import { SiteImage } from '../../components/ui/SiteImage';
import { useProductConfig } from '../../config/ProductConfigProvider';
import { siteImages } from '../../content/siteImages';
import { serviceHighlights, serviceProcess } from '../../features/services/data';
import type { ServiceSort } from '../../features/services/types';
import { useServices } from '../../features/services/useServices';
import { filterServices, isFeaturedService, sortServices } from '../../features/services/utils';
import { usePageMeta } from '../../hooks/usePageMeta';

const processStepIcons = [ClipboardList, CalendarCheck, MapPin] as const;

export function ServicesPage() {
  const productConfig = useProductConfig();
  usePageMeta({
    title: 'Услуги автосервиса',
    description: 'Полный каталог работ с ценами, фильтрами и онлайн-записью.',
    preloadImage: siteImages.hero.services,
  });

  const { services, loading, error } = useServices();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<ServiceSort>('default');

  const visible = useMemo(() => {
    const filtered = filterServices(services, { query, category });
    return sortServices(filtered, sort);
  }, [services, query, category, sort]);

  const featured = services.find(isFeaturedService);

  return (
    <div className="fm-page fm-svc-page">
      <Reveal as="header" className="fm-svc-hero">
        <div className="fm-svc-hero__copy">
          <p className="fm-pill">
            <MessageSquare size={14} aria-hidden="true" />
            {services.length} услуг · онлайн-запись
          </p>
          <h1>Услуги автосервиса</h1>
          <p>
            Диагностика, ремонт и обслуживание с прозрачными ценами. Не знаете, что именно нужно — начните с
            ИИ-разбора симптомов, это бесплатно.
          </p>
          <div className="fm-actions">
            <Link className="fm-btn fm-btn-primary" to="/consult">
              ИИ-диагностика
            </Link>
            <Link className="fm-btn fm-btn-outline" to="/booking">
              Записаться без выбора услуги
            </Link>
          </div>
        </div>

        <div className="fm-svc-hero__visual">
          <SiteImage className="fm-svc-hero__photo" src={siteImages.hero.services} alt="" priority />
          <div className="fm-svc-hero__stats">
          {serviceHighlights.map((item) => (
            <div key={item.label} className="fm-svc-highlight">
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
          </div>
        </div>
      </Reveal>

      {loading ? <Loader /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!loading && !error ? (
        <>
          <Reveal delay={120}>
            <ServicesToolbar
              services={services}
              query={query}
              category={category}
              sort={sort}
              onQueryChange={setQuery}
              onCategoryChange={setCategory}
              onSortChange={setSort}
            />
          </Reveal>

          {visible.length > 0 ? (
            <p className="fm-works-results" aria-live="polite">
              {visible.length === services.length
                ? `Показаны все ${visible.length} услуг`
                : `Найдено ${visible.length} из ${services.length}`}
            </p>
          ) : null}

          {visible.length === 0 ? (
            <EmptyState
              title="Ничего не найдено"
              description="Попробуйте другой запрос или сбросьте фильтр категории."
            />
          ) : (
            <div className="fm-svc-grid">
              {visible.map((item, i) => (
                <Reveal key={item.id} as="div" delay={Math.min(i * 40, 320)}>
                  <ServiceCard
                    item={item}
                    variant={isFeaturedService(item) ? 'featured' : 'default'}
                    index={i}
                  />
                </Reveal>
              ))}
            </div>
          )}

          <Reveal as="section" className="fm-svc-process" aria-label="Как записаться">
            <header className="fm-svc-process__head">
              <h2>Как записаться на услугу</h2>
              <p>Три шага — от выбора работы до записи в сервис</p>
            </header>
            <ol className="fm-svc-process__steps">
              {serviceProcess.map((step, index) => {
                const Icon = processStepIcons[index] ?? ClipboardList;

                return (
                  <li key={step.step} className="fm-svc-step">
                    <div className="fm-svc-step__top">
                      <span className="fm-svc-step__num" aria-hidden="true">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="fm-svc-step__icon" aria-hidden="true">
                        <Icon size={18} />
                      </span>
                    </div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </li>
                );
              })}
            </ol>
          </Reveal>

          <Reveal as="section" className="fm-svc-cta-banner">
            <div className="fm-svc-cta-banner__main">
              <p className="fm-svc-cta-banner__eyebrow">
                <Sparkles size={14} aria-hidden="true" />
                ИИ-помощник · бесплатно
              </p>
              <h2>Не уверены, какая услуга нужна?</h2>
              <p className="fm-svc-cta-banner__text">
                {productConfig.assistantName} поможет определить вероятные причины, оценить срочность и подобрать
                работы — затем передайте отчёт мастеру одним кликом.
              </p>
            </div>
            <div className="fm-svc-cta-banner__aside">
              <div className="fm-svc-cta-banner__actions">
                <Link className="fm-btn fm-btn-primary" to="/consult">
                  Начать ИИ-диагностику
                </Link>
                {productConfig.phone ? (
                  <a className="fm-btn fm-btn-outline" href={`tel:${productConfig.phone.replace(/[^\d+]/g, '')}`}>
                    <Phone size={16} aria-hidden="true" />
                    Позвонить
                  </a>
                ) : null}
              </div>
              {featured ? (
                <p className="fm-svc-cta-banner__hint">
                  Или сразу запишитесь на «{featured.title}» — <Link to="/consult">открыть чат</Link>
                </p>
              ) : null}
            </div>
          </Reveal>
        </>
      ) : null}
    </div>
  );
}
