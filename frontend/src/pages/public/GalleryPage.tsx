import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  Car,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Expand,
  MapPin,
  Sparkles,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useProductConfig } from '../../config/ProductConfigProvider';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { Reveal } from '../../components/ui/Reveal';
import { SiteImage } from '../../components/ui/SiteImage';
import { fallbackGalleryItems, galleryImageAt, siteImages } from '../../content/siteImages';
import { useAsyncState } from '../../hooks/useAsyncState';
import { usePageMeta } from '../../hooks/usePageMeta';
import { cachedPublicFetch } from '../../lib/publicContentCache';

interface GalleryItem {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
}

type GalleryZone = 'all' | 'reception' | 'posts' | 'floor' | 'equipment' | 'delivery' | 'diagnostics' | 'electrics';

const ZONE_FILTERS: { id: GalleryZone; label: string; icon: typeof Building2 }[] = [
  { id: 'all', label: 'Все зоны', icon: Sparkles },
  { id: 'reception', label: 'Приём', icon: Building2 },
  { id: 'posts', label: 'Посты', icon: Car },
  { id: 'floor', label: 'Цех', icon: Wrench },
  { id: 'equipment', label: 'Оборудование', icon: Cpu },
  { id: 'delivery', label: 'Выдача', icon: CheckCircle2 },
  { id: 'diagnostics', label: 'Диагностика', icon: Zap },
  { id: 'electrics', label: 'Электрика', icon: Zap },
];

type EnrichedGalleryItem = {
  item: GalleryItem;
  zone: GalleryZone;
  image: string;
};

function zoneLabel(zone: GalleryZone) {
  return ZONE_FILTERS.find((z) => z.id === zone)?.label ?? 'Сервис';
}

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

function layoutClass(index: number, total: number): string {
  if (total === 1) return 'fm-gallery-item--hero';
  if (index === 0) return 'fm-gallery-item--hero';
  if (index === 1) return 'fm-gallery-item--tall';
  if (index === 2) return 'fm-gallery-item--wide';
  if (index % 6 === 3) return 'fm-gallery-item--wide';
  if (index % 5 === 4) return 'fm-gallery-item--tall';
  return 'fm-gallery-item--std';
}

function GalleryLightbox({
  items,
  zones,
  index,
  onClose,
  onPrev,
  onNext,
  onSelect,
}: {
  items: GalleryItem[];
  zones: GalleryZone[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (nextIndex: number) => void;
}) {
  const item = items[index];
  const imageSrc = itemImage(item, index);
  const zone = zones[index];
  const touchStartX = useRef<number | null>(null);

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

  function onTouchStart(event: TouchEvent<HTMLElement>) {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  }

  function onTouchEnd(event: TouchEvent<HTMLElement>) {
    const start = touchStartX.current;
    const end = event.changedTouches[0]?.clientX;
    touchStartX.current = null;
    if (start == null || end == null) return;
    const delta = end - start;
    if (Math.abs(delta) < 48) return;
    if (delta > 0) onPrev();
    else onNext();
  }

  return (
    <div className="fm-gallery-lightbox" role="dialog" aria-modal="true" aria-label={item.title}>
      <button type="button" className="fm-gallery-lightbox-backdrop" onClick={onClose} aria-label="Закрыть" />
      <div className="fm-gallery-lightbox-panel">
        <header className="fm-gallery-lightbox-head">
          <div>
            <div className="fm-gallery-lightbox-meta">
              <span className={`fm-tag fm-gallery-lightbox-zone fm-gallery-lightbox-zone--${zone}`}>
                {zoneLabel(zone)}
              </span>
              <p className="fm-gallery-lightbox-counter">
                {index + 1} / {items.length}
              </p>
            </div>
            <h2>{item.title}</h2>
          </div>
          <button type="button" className="fm-gallery-lightbox-close" onClick={onClose} aria-label="Закрыть">
            <X size={20} />
          </button>
        </header>

        <div className="fm-gallery-lightbox-progress" aria-hidden="true">
          <span style={{ width: `${((index + 1) / items.length) * 100}%` }} />
        </div>

        <figure
          className="fm-gallery-lightbox-figure"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <button type="button" className="fm-gallery-lightbox-side fm-gallery-lightbox-side--prev" onClick={onPrev} aria-label="Предыдущее фото">
            <ArrowLeft size={20} />
          </button>
          <div className="fm-gallery-lightbox-stage">
            <SiteImage key={item.id} src={imageSrc} alt={item.title} priority />
          </div>
          <button type="button" className="fm-gallery-lightbox-side fm-gallery-lightbox-side--next" onClick={onNext} aria-label="Следующее фото">
            <ArrowRight size={20} />
          </button>
          {item.description ? <figcaption>{item.description}</figcaption> : null}
        </figure>

        {items.length > 1 ? (
          <div className="fm-gallery-lightbox-thumbs" role="tablist" aria-label="Миниатюры">
            {items.map((thumb, thumbIndex) => (
              <button
                key={thumb.id}
                type="button"
                role="tab"
                aria-selected={thumbIndex === index}
                aria-label={thumb.title}
                className={`fm-gallery-lightbox-thumb${thumbIndex === index ? ' is-active' : ''}`}
                onClick={() => onSelect(thumbIndex)}
              >
                <SiteImage src={itemImage(thumb, thumbIndex)} alt="" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function GalleryPage() {
  const productConfig = useProductConfig();
  usePageMeta({
    title: 'Галерея сервиса',
    description: 'Фото зоны обслуживания, постов и результатов работ.',
    preloadImage: siteImages.gallery.reception,
  });

  const { data, error, loading, reload } = useAsyncState<GalleryItem[]>(() =>
    cachedPublicFetch('site-items:gallery', () => api('/content/site-items?kind=gallery')),
  );
  const [activeZone, setActiveZone] = useState<GalleryZone>('all');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [pendingLightboxId, setPendingLightboxId] = useState<string | null>(null);
  const [gridPulse, setGridPulse] = useState(0);

  const items = data?.length ? data : fallbackGalleryItems;
  const showLoadError = Boolean(error) && items.length === 0;

  const enriched = useMemo<EnrichedGalleryItem[]>(
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

  const heroItems = enriched.slice(0, 3);
  const visibleFilters = ZONE_FILTERS.filter((f) => f.id === 'all' || (zoneCounts[f.id] ?? 0) > 0);

  const openLightbox = useCallback((id: string) => {
    const idx = filtered.findIndex((x) => x.item.id === id);
    if (idx >= 0) setLightboxIndex(idx);
  }, [filtered]);

  const openLightboxFromHero = useCallback(
    (id: string) => {
      const inFilter = filtered.findIndex((x) => x.item.id === id);
      if (inFilter >= 0) {
        setLightboxIndex(inFilter);
        return;
      }
      setPendingLightboxId(id);
      setActiveZone('all');
    },
    [filtered],
  );

  useEffect(() => {
    if (!pendingLightboxId || activeZone !== 'all') return;
    const idx = enriched.findIndex((x) => x.item.id === pendingLightboxId);
    if (idx >= 0) setLightboxIndex(idx);
    setPendingLightboxId(null);
  }, [activeZone, enriched, pendingLightboxId]);

  const changeZone = useCallback((zone: GalleryZone) => {
    setActiveZone(zone);
    setGridPulse((n) => n + 1);
    setLightboxIndex(null);
  }, []);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const prevLightbox = useCallback(() => {
    if (lightboxIndex === null || filtered.length === 0) return;
    setLightboxIndex((lightboxIndex - 1 + filtered.length) % filtered.length);
  }, [filtered.length, lightboxIndex]);

  const nextLightbox = useCallback(() => {
    if (lightboxIndex === null || filtered.length === 0) return;
    setLightboxIndex((lightboxIndex + 1) % filtered.length);
  }, [filtered.length, lightboxIndex]);

  const heroHighlights = useMemo(
    () => [
      { value: String(items.length || '8+'), label: 'фото в галерее' },
      { value: String(visibleFilters.length - 1), label: 'зон сервиса' },
      { value: productConfig.workingHours.split(' ')[0], label: 'режим работы' },
    ],
    [items.length, productConfig.workingHours, visibleFilters.length],
  );

  return (
    <div className="fm-page fm-gallery-page">
      <Reveal as="header" className="fm-gallery-hero" aria-label="Галерея сервиса">
        <div className="fm-gallery-hero__copy">
          <p className="fm-pill">
            <Camera size={14} aria-hidden="true" />
            Внутри сервиса
          </p>
          <h1>Галерея — как выглядит сервис до визита</h1>
          <p>
            Зона приёма, посты на подъёмниках, цех, диагностика и выдача авто. Посмотрите, где проходит
            обслуживание, и приезжайте с пониманием процесса.
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
          <p className="fm-gallery-hero__meta">
            <MapPin size={14} aria-hidden="true" />
            {productConfig.address} · {productConfig.workingHours}
          </p>
        </div>

        <div className="fm-gallery-hero__visual">
          <div className="fm-gallery-mosaic">
            {(heroItems.length > 0
              ? heroItems
              : [
                  { item: { id: 'h1', title: 'Приём' }, zone: 'reception' as const, image: siteImages.gallery.reception },
                  { item: { id: 'h2', title: 'Пост' }, zone: 'posts' as const, image: siteImages.gallery.bay },
                  { item: { id: 'h3', title: 'Цех' }, zone: 'floor' as const, image: siteImages.gallery.shopfloor },
                ]
            ).map((row, i) => (
              <button
                key={row.item.id}
                type="button"
                className={`fm-gallery-mosaic-cell fm-gallery-mosaic-cell--${i + 1}`}
                onClick={() => openLightboxFromHero(row.item.id)}
                aria-label={`Открыть: ${row.item.title}`}
              >
                <SiteImage src={row.image} alt="" priority={i === 0} />
                <span className="fm-gallery-mosaic-label">{zoneLabel(row.zone)}</span>
              </button>
            ))}
          </div>
          <p className="fm-gallery-hero__badge">
            <Sparkles size={14} aria-hidden="true" />
            Фото реального сервиса
          </p>
          <div className="fm-gallery-hero__stats" aria-hidden="true">
            {heroHighlights.map((item) => (
              <div key={item.label} className="fm-gallery-highlight">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {loading ? <Loader /> : null}
      {showLoadError ? <ErrorState message={error!} onRetry={() => void reload()} /> : null}
      {!loading && !showLoadError && items.length === 0 ? (
        <EmptyState description="Галерея пока пустая." />
      ) : null}

      {!loading && !showLoadError && items.length > 0 ? (
        <>
          <div className="fm-gallery-controls-sticky">
            <Reveal as="section" className="fm-gallery-controls" delay={120}>
              <div className="fm-gallery-controls-head">
                <div>
                  <h2>Зоны сервиса</h2>
                  <p>От приёма до выдачи автомобиля — выберите раздел галереи.</p>
                </div>
                <p className="fm-gallery-results" aria-live="polite">
                  {activeZone === 'all'
                    ? `${filtered.length} фото во всех зонах`
                    : `${filtered.length} ${filtered.length === 1 ? 'фото' : 'фото'} · ${zoneLabel(activeZone)}`}
                </p>
              </div>

              <div className="fm-gallery-filters-wrap">
                <div className="fm-gallery-filters" role="tablist" aria-label="Фильтр зон">
                  {visibleFilters.map((filter) => {
                    const Icon = filter.icon;
                    return (
                      <button
                        key={filter.id}
                        type="button"
                        role="tab"
                        aria-selected={activeZone === filter.id}
                        className={`fm-gallery-filter fm-gallery-filter--${filter.id}${activeZone === filter.id ? ' is-active' : ''}`}
                        onClick={() => changeZone(filter.id)}
                      >
                        <Icon size={14} aria-hidden="true" />
                        {filter.label}
                        {filter.id !== 'all' ? (
                          <span className="fm-gallery-filter-count">{zoneCounts[filter.id]}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Reveal>
          </div>

          {filtered.length === 0 ? (
            <EmptyState description="В этой зоне пока нет фото. Выберите другой фильтр." />
          ) : (
            <div key={`${activeZone}-${gridPulse}`} className="fm-gallery-bento fm-gallery-bento--enter" role="list">
              {filtered.map(({ item, zone, image }, index) => (
                <Reveal
                  key={item.id}
                  as="article"
                  className={`fm-gallery-item ${layoutClass(index, filtered.length)}`}
                  delay={Math.min(index * 45, 280)}
                >
                  <button
                    type="button"
                    className="fm-gallery-item-btn"
                    data-zone={zone}
                    onClick={() => openLightbox(item.id)}
                    aria-label={`Открыть: ${item.title}`}
                  >
                    <SiteImage src={image} alt="" />
                    <span className="fm-gallery-item-shine" aria-hidden="true" />
                    <span className="fm-gallery-item-index" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="fm-gallery-item-overlay">
                      <span className={`fm-tag fm-gallery-zone-tag fm-gallery-zone-tag--${zone}`}>{zoneLabel(zone)}</span>
                      <strong>{item.title}</strong>
                      {item.description ? <span className="fm-gallery-item-desc">{item.description}</span> : null}
                      <span className="fm-gallery-expand" aria-hidden="true">
                        <Expand size={16} />
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
              <h3>Записаться на пост</h3>
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
          zones={filtered.map((x) => x.zone)}
          index={lightboxIndex}
          onClose={closeLightbox}
          onPrev={prevLightbox}
          onNext={nextLightbox}
          onSelect={setLightboxIndex}
        />
      ) : null}
    </div>
  );
}
