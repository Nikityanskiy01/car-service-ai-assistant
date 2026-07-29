import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  ChevronRight,
  Expand,
  MapPin,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useProductConfig } from '../../config/ProductConfigProvider';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { Reveal } from '../../components/ui/Reveal';
import { fallbackGalleryItems, galleryImageAt, siteImages } from '../../content/siteImages';
import { useAsyncState } from '../../hooks/useAsyncState';
import { usePageMeta } from '../../hooks/usePageMeta';

interface GalleryItem {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
}

type GalleryZone = 'all' | 'reception' | 'posts' | 'floor' | 'equipment' | 'delivery' | 'diagnostics' | 'electrics';

const ZONE_FILTERS: { id: GalleryZone; label: string }[] = [
  { id: 'all', label: 'Все зоны' },
  { id: 'reception', label: 'Приём' },
  { id: 'posts', label: 'Посты' },
  { id: 'floor', label: 'Цех' },
  { id: 'equipment', label: 'Оборудование' },
  { id: 'delivery', label: 'Выдача' },
  { id: 'diagnostics', label: 'Диагностика' },
  { id: 'electrics', label: 'Электрика' },
];

function inferZone(item: GalleryItem): GalleryZone {
  const text = `${item.title} ${item.description || ''} ${item.imageUrl || ''}`.toLowerCase();
  if (/приём|reception/.test(text)) return 'reception';
  if (/пост|подъёмник|bay/.test(text)) return 'posts';
  if (/цех|shopfloor/.test(text)) return 'floor';
  if (/развал|alignment|инструмент|tools/.test(text)) return 'equipment';
  if (/после|ready|выдача/.test(text)) return 'delivery';
  if (/диагност/.test(text)) return 'diagnostics';
  if (/электр|electrics/.test(text)) return 'electrics';
  return 'floor';
}

function itemImage(item: GalleryItem, index: number) {
  return galleryImageAt(index, item.imageUrl);
}

function layoutClass(index: number): string {
  if (index === 0) return 'fm-gallery-item--hero';
  if (index === 1) return 'fm-gallery-item--wide';
  if (index === 2) return 'fm-gallery-item--tall';
  if (index % 5 === 0) return 'fm-gallery-item--wide';
  if (index % 7 === 0) return 'fm-gallery-item--tall';
  return 'fm-gallery-item--std';
}

function GalleryLightbox({
  items,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  items: GalleryItem[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const item = items[index];
  const imageSrc = itemImage(item, index);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') onPrev();
      if (event.key === 'ArrowRight') onNext();
    }

    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, onNext, onPrev]);

  return (
    <div className="fm-gallery-lightbox" role="dialog" aria-modal="true" aria-label={item.title}>
      <button type="button" className="fm-gallery-lightbox-backdrop" onClick={onClose} aria-label="Закрыть" />
      <div className="fm-gallery-lightbox-panel">
        <header className="fm-gallery-lightbox-head">
          <div>
            <p className="fm-gallery-lightbox-counter">
              {index + 1} / {items.length}
            </p>
            <h2>{item.title}</h2>
          </div>
          <button type="button" className="fm-gallery-lightbox-close" onClick={onClose} aria-label="Закрыть">
            <X size={20} />
          </button>
        </header>

        <figure className="fm-gallery-lightbox-figure">
          <img src={imageSrc} alt={item.title} />
          {item.description ? <figcaption>{item.description}</figcaption> : null}
        </figure>

        <div className="fm-gallery-lightbox-nav">
          <button type="button" className="fm-gallery-lightbox-arrow" onClick={onPrev} aria-label="Предыдущее фото">
            <ArrowLeft size={18} />
          </button>
          <button type="button" className="fm-gallery-lightbox-arrow" onClick={onNext} aria-label="Следующее фото">
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function GalleryPage() {
  const productConfig = useProductConfig();
  usePageMeta({
    title: 'Галерея сервиса',
    description: 'Фото зоны обслуживания, постов и результатов работ.',
  });

  const { data, error, loading } = useAsyncState<GalleryItem[]>(() => api('/content/site-items?kind=gallery'));
  const [activeZone, setActiveZone] = useState<GalleryZone>('all');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const items = data?.length ? data : fallbackGalleryItems;

  const enriched = useMemo(
    () => items.map((item, index) => ({ item, zone: inferZone(item), image: itemImage(item, index) })),
    [items],
  );

  const filtered = useMemo(
    () => (activeZone === 'all' ? enriched : enriched.filter((x) => x.zone === activeZone)),
    [activeZone, enriched],
  );

  const zoneCounts = useMemo(() => {
    const counts: Partial<Record<GalleryZone, number>> = { all: enriched.length };
    for (const row of enriched) {
      counts[row.zone] = (counts[row.zone] ?? 0) + 1;
    }
    return counts;
  }, [enriched]);

  const heroImages = enriched.slice(0, 3).map((x) => x.image);
  const visibleFilters = ZONE_FILTERS.filter((f) => f.id === 'all' || (zoneCounts[f.id] ?? 0) > 0);

  const openLightbox = useCallback((id: string) => {
    const idx = filtered.findIndex((x) => x.item.id === id);
    if (idx >= 0) setLightboxIndex(idx);
  }, [filtered]);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const prevLightbox = useCallback(() => {
    if (lightboxIndex === null || filtered.length === 0) return;
    setLightboxIndex((lightboxIndex - 1 + filtered.length) % filtered.length);
  }, [filtered.length, lightboxIndex]);

  const nextLightbox = useCallback(() => {
    if (lightboxIndex === null || filtered.length === 0) return;
    setLightboxIndex((lightboxIndex + 1) % filtered.length);
  }, [filtered.length, lightboxIndex]);

  return (
    <div className="fm-gallery-page">
      <Reveal as="section" className="fm-gallery-hero" aria-label="Галерея сервиса">
        <div className="fm-gallery-hero-copy">
          <p className="fm-pill">
            <Camera size={14} aria-hidden="true" />
            Внутри сервиса
          </p>
          <h1>Галерея — как выглядит сервис до визита</h1>
          <p className="fm-lead">
            Зона приёма, посты на подъёмниках, цех, диагностика и выдача авто. Посмотрите, где проходит обслуживание —
            и приезжайте с пониманием процесса.
          </p>
          <div className="fm-actions">
            <Link className="fm-btn fm-btn-primary" to="/booking">
              Записаться на пост
            </Link>
            <Link className="fm-btn fm-btn-outline" to="/works">
              Примеры работ
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <p className="fm-meta">
            <MapPin size={14} aria-hidden="true" />
            {productConfig.address} · {productConfig.workingHours}
          </p>
        </div>

        <div className="fm-gallery-hero-visual" aria-hidden="true">
          <div className="fm-gallery-mosaic">
            {heroImages.length > 0 ? (
              heroImages.map((src, i) => (
                <div key={src} className={`fm-gallery-mosaic-cell fm-gallery-mosaic-cell--${i + 1}`}>
                  <img src={src} alt="" />
                </div>
              ))
            ) : (
              <>
                <div className="fm-gallery-mosaic-cell fm-gallery-mosaic-cell--1">
                  <img src={siteImages.gallery.reception} alt="" />
                </div>
                <div className="fm-gallery-mosaic-cell fm-gallery-mosaic-cell--2">
                  <img src={siteImages.gallery.bay} alt="" />
                </div>
                <div className="fm-gallery-mosaic-cell fm-gallery-mosaic-cell--3">
                  <img src={siteImages.gallery.shopfloor} alt="" />
                </div>
              </>
            )}
          </div>
          <div className="fm-gallery-hero-badge">
            <Sparkles size={16} aria-hidden="true" />
            <span>Фото реального сервиса</span>
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className="fm-stats fm-gallery-stats" delay={80} aria-label="О сервисе">
        <div>
          <strong>{items.length || '8+'}</strong>
          <span>зон и постов</span>
        </div>
        <div>
          <strong>
            <Building2 size={22} aria-hidden="true" />
          </strong>
          <span>цех и приём клиентов</span>
        </div>
        <div>
          <strong>
            <Wrench size={22} aria-hidden="true" />
          </strong>
          <span>оснастка и диагностика</span>
        </div>
        <div>
          <strong>{productConfig.workingHours.split(' ')[0]}</strong>
          <span>режим работы</span>
        </div>
      </Reveal>

      {loading ? <Loader /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState description="Галерея пока пустая." />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <Reveal as="section" className="fm-gallery-controls" delay={120}>
            <div className="fm-gallery-controls-head">
              <h2>Зоны сервиса</h2>
              <p>Фильтр по зонам — от приёма до выдачи автомобиля.</p>
            </div>
            <div className="fm-gallery-filters" role="tablist" aria-label="Фильтр зон">
              {visibleFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  role="tab"
                  aria-selected={activeZone === filter.id}
                  className={`fm-gallery-filter${activeZone === filter.id ? ' is-active' : ''}`}
                  onClick={() => setActiveZone(filter.id)}
                >
                  {filter.label}
                  {filter.id !== 'all' ? <span className="fm-gallery-filter-count">{zoneCounts[filter.id]}</span> : null}
                </button>
              ))}
            </div>
          </Reveal>

          {filtered.length === 0 ? (
            <EmptyState description="В этой зоне пока нет фото. Выберите другой фильтр." />
          ) : (
            <div className="fm-gallery-bento" role="list">
              {filtered.map(({ item, zone, image }, index) => (
                <Reveal
                  key={item.id}
                  as="article"
                  className={`fm-gallery-item ${layoutClass(index)}`}
                  delay={Math.min(index * 60, 360)}
                >
                  <button
                    type="button"
                    className="fm-gallery-item-btn"
                    onClick={() => openLightbox(item.id)}
                    aria-label={`Открыть: ${item.title}`}
                  >
                    <img src={image} alt={item.title} loading="lazy" />
                    <span className="fm-gallery-item-overlay">
                      <span className="fm-tag">{ZONE_FILTERS.find((z) => z.id === zone)?.label ?? 'Сервис'}</span>
                      <strong>{item.title}</strong>
                      {item.description ? <span>{item.description}</span> : null}
                      <span className="fm-gallery-expand">
                        <Expand size={16} aria-hidden="true" />
                        Увеличить
                      </span>
                    </span>
                  </button>
                </Reveal>
              ))}
            </div>
          )}

          <Reveal as="section" className="fm-section fm-dual-cta fm-gallery-cta" delay={160}>
            <article className="fm-card">
              <h3>Запись на пост</h3>
              <p>Выберите услугу и время — мастер подтвердит визит и подготовит пост.</p>
              <Link className="fm-btn fm-btn-primary" to="/booking">
                Записаться в сервис
              </Link>
            </article>
            <article className="fm-card fm-card-accent">
              <h3>ИИ-диагностика до визита</h3>
              <p>Опишите симптомы — ассистент подготовит чек-лист и оценку срочности для мастера.</p>
              <Link className="fm-btn fm-btn-outline" to="/consult">
                Начать диагностику
              </Link>
            </article>
          </Reveal>
        </>
      ) : null}

      {lightboxIndex !== null && filtered.length > 0 ? (
        <GalleryLightbox
          items={filtered.map((x) => x.item)}
          index={lightboxIndex}
          onClose={closeLightbox}
          onPrev={prevLightbox}
          onNext={nextLightbox}
        />
      ) : null}
    </div>
  );
}
