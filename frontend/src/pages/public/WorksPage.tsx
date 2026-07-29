import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  MessageSquare,
  Search,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { Reveal } from '../../components/ui/Reveal';
import { siteImages, workImageAt } from '../../content/siteImages';
import { useAsyncState } from '../../hooks/useAsyncState';
import { usePageMeta } from '../../hooks/usePageMeta';

interface WorkItem {
  id: string;
  title: string;
  problem?: string;
  result?: string;
  term?: string;
  description?: string;
  imageUrl?: string;
}

type WorkCategory = {
  id: string;
  label: string;
  keywords: string[];
};

const CATEGORIES: WorkCategory[] = [
  { id: 'all', label: 'Все кейсы', keywords: [] },
  {
    id: 'brakes',
    label: 'Тормоза',
    keywords: ['тормоз', 'колод', 'диск', 'суппорт', 'вибрац'],
  },
  {
    id: 'suspension',
    label: 'Подвеска',
    keywords: ['подвес', 'стойк', 'рычаг', 'сайлент', 'стук', 'кочк'],
  },
  {
    id: 'engine',
    label: 'Двигатель',
    keywords: ['двиг', 'оборот', 'троен', 'check engine', 'дроссел', 'свеч', 'катуш'],
  },
  {
    id: 'transmission',
    label: 'Трансмиссия',
    keywords: ['акпп', 'кпп', 'рывк', 'коробк', 'сцеплен'],
  },
  {
    id: 'electric',
    label: 'Электрика',
    keywords: ['аккум', 'электр', 'утечк', 'разряд', 'провод'],
  },
  {
    id: 'service',
    label: 'ТО',
    keywords: ['то ', 'регламент', 'планов', 'обслуживан', '90 тыс', 'масло', 'фильтр'],
  },
  {
    id: 'ac',
    label: 'Климат',
    keywords: ['кондиц', 'фреон', 'холод', 'ск '],
  },
];

const fallbackWorks: WorkItem[] = [
  {
    id: 'fw1',
    title: 'Toyota Camry 2018 — вибрация при торможении',
    description: 'Диагностика тормозных дисков и суппортов, замена комплекта дисков и колодок.',
    problem: 'Вибрация в руль на скорости 70–90 км/ч при торможении',
    result: 'Биение устранено, тормозной путь в норме',
    term: '1 рабочий день',
    imageUrl: siteImages.works.brakes,
  },
  {
    id: 'fw2',
    title: 'Kia Rio 2019 — стук на кочках',
    description: 'Замена передних стоек и опор, контрольный осмотр рычагов.',
    problem: 'Глухой стук спереди на неровностях',
    result: 'Подвеска работает тихо, люфты устранены',
    term: '1–2 дня',
    imageUrl: siteImages.works.suspension,
  },
  {
    id: 'fw3',
    title: 'Volkswagen Polo 2020 — нестабильные обороты',
    description: 'Диагностика дроссельной заслонки, чистка, адаптация и тест-драйв.',
    problem: 'Плавающие обороты холостого хода',
    result: 'Работа двигателя стабилизирована',
    term: '1 рабочий день',
    imageUrl: siteImages.works.diagnostics,
  },
  {
    id: 'fw4',
    title: 'Hyundai Solaris 2017 — плановое ТО 90 тыс.',
    description: 'Масло, фильтры, свечи, промывка системы охлаждения.',
    problem: 'Регламентное обслуживание по пробегу',
    result: 'ТО выполнено, рекомендации по следующим узлам зафиксированы',
    term: 'в день обращения',
    imageUrl: siteImages.works.service,
  },
  {
    id: 'fw5',
    title: 'Skoda Octavia 2016 — рывки АКПП',
    description: 'Замена масла и фильтра АКПП, адаптация коробки.',
    problem: 'Рывки при переключении 2–3 передачи',
    result: 'Переключения стали плавными',
    term: '1 день',
    imageUrl: siteImages.works.transmission,
  },
  {
    id: 'fw6',
    title: 'Renault Duster 2015 — разряд АКБ',
    description: 'Поиск паразитного потребления, ремонт цепи освещения багажника.',
    problem: 'Аккумулятор садится за ночь',
    result: 'Утечка устранена, заряд держится',
    term: '4 часа',
    imageUrl: siteImages.works.electrics,
  },
];

function inferCategory(item: WorkItem): string {
  const text = [item.title, item.problem, item.description, item.result].filter(Boolean).join(' ').toLowerCase();
  let best = { id: 'other', score: 0 };
  for (const cat of CATEGORIES) {
    if (cat.id === 'all') continue;
    const score = cat.keywords.reduce((acc, kw) => (text.includes(kw) ? acc + 1 : acc), 0);
    if (score > best.score) best = { id: cat.id, score };
  }
  return best.id;
}

function categoryLabel(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? 'Ремонт';
}

function parseVehicle(title: string) {
  const match = title.match(/^(.+?)\s*[—–-]\s*(.+)$/u);
  if (!match) return { vehicle: title, symptom: '' };
  return { vehicle: match[1].trim(), symptom: match[2].trim() };
}

function WorkCaseCard({
  item,
  featured = false,
  onOpen,
}: {
  item: WorkItem;
  featured?: boolean;
  onOpen: (item: WorkItem) => void;
}) {
  const category = inferCategory(item);
  const { vehicle, symptom } = parseVehicle(item.title);

  return (
    <article
      className={`fm-works-card${featured ? ' fm-works-card-featured' : ''}`}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(item);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Кейс: ${item.title}`}
    >
      <div className="fm-works-card-media">
        <img src={workImageAt(item.imageUrl)} alt="" loading="lazy" />
        <div className="fm-works-card-overlay" aria-hidden="true" />
        <span className="fm-tag">{categoryLabel(category)}</span>
        {item.term ? (
          <span className="fm-works-term">
            <Clock size={13} aria-hidden="true" />
            {item.term}
          </span>
        ) : null}
      </div>

      <div className="fm-works-card-body">
        <h3>{vehicle}</h3>
        {symptom ? <p className="fm-works-symptom">{symptom}</p> : null}

        <div className="fm-works-flow">
          <div className="fm-works-flow-step fm-works-flow-problem">
            <AlertCircle size={15} aria-hidden="true" />
            <div>
              <span>Проблема</span>
              <p>{item.problem || 'Симптом уточняется на диагностике'}</p>
            </div>
          </div>
          <ArrowRight className="fm-works-flow-arrow" size={16} aria-hidden="true" />
          <div className="fm-works-flow-step fm-works-flow-result">
            <CheckCircle2 size={15} aria-hidden="true" />
            <div>
              <span>Результат</span>
              <p>{item.result || 'Ремонт выполнен, авто выдано клиенту'}</p>
            </div>
          </div>
        </div>

        <span className="fm-works-more">
          Подробнее
          <ArrowRight size={14} aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

function WorkDetailModal({ item, onClose }: { item: WorkItem | null; onClose: () => void }) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [item, onClose]);

  if (!item) return null;

  const category = inferCategory(item);
  const { vehicle, symptom } = parseVehicle(item.title);

  return (
    <div className="fm-works-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="fm-works-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-modal-title"
      >
        <button type="button" className="fm-works-modal-close" onClick={onClose} aria-label="Закрыть">
          <X size={20} />
        </button>

        <div className="fm-works-modal-grid">
          <div className="fm-works-modal-media">
            <img src={workImageAt(item.imageUrl)} alt="" />
            <div className="fm-works-modal-badges">
              <span className="fm-tag">{categoryLabel(category)}</span>
              {item.term ? (
                <span className="fm-works-term fm-works-term-inline">
                  <Clock size={13} aria-hidden="true" />
                  {item.term}
                </span>
              ) : null}
            </div>
          </div>

          <div className="fm-works-modal-content">
            <h2 id="work-modal-title">{vehicle}</h2>
            {symptom ? <p className="fm-works-modal-symptom">{symptom}</p> : null}

            <div className="fm-works-modal-blocks">
              <div className="fm-works-modal-block fm-works-modal-block-problem">
                <AlertCircle size={18} aria-hidden="true" />
                <div>
                  <strong>Что беспокоило</strong>
                  <p>{item.problem || '—'}</p>
                </div>
              </div>
              <div className="fm-works-modal-block fm-works-modal-block-result">
                <CheckCircle2 size={18} aria-hidden="true" />
                <div>
                  <strong>Что сделали</strong>
                  <p>{item.description || item.result || '—'}</p>
                </div>
              </div>
              <div className="fm-works-modal-block fm-works-modal-block-outcome">
                <Wrench size={18} aria-hidden="true" />
                <div>
                  <strong>Итог для клиента</strong>
                  <p>{item.result || 'Автомобиль выдан после контрольной проверки.'}</p>
                </div>
              </div>
            </div>

            <div className="fm-works-modal-actions">
              <Link className="fm-btn fm-btn-primary" to="/booking" onClick={onClose}>
                Записаться на ремонт
              </Link>
              <Link className="fm-btn fm-btn-outline" to="/consult" onClick={onClose}>
                ИИ-диагностика
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorksPage() {
  usePageMeta({
    title: 'Выполненные работы',
    description: 'Реальные кейсы ремонта: симптом, диагностика, результат и сроки.',
  });

  const { data, error, loading } = useAsyncState<WorkItem[]>(() => api('/content/site-items?kind=work'));
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<WorkItem | null>(null);

  const works = data?.length ? data : fallbackWorks;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return works.filter((item) => {
      const cat = inferCategory(item);
      if (categoryFilter !== 'all' && cat !== categoryFilter) return false;
      if (!q) return true;
      const haystack = [item.title, item.problem, item.result, item.description, item.term]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [works, categoryFilter, search]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of works) {
      const cat = inferCategory(item);
      counts.set(cat, (counts.get(cat) || 0) + 1);
    }
    return counts;
  }, [works]);

  const avgTermLabel = useMemo(() => {
    const terms = works.map((w) => w.term).filter(Boolean);
    if (!terms.length) return '1–2 дня';
    const sameDay = terms.filter((t) => /день|час/i.test(t || '')).length;
    return sameDay >= terms.length / 2 ? 'в день обращения' : '1–2 дня';
  }, [works]);

  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div className="fm-works-page">
      <Reveal as="header" className="fm-works-hero">
        <img className="fm-works-hero-photo" src={siteImages.hero.services} alt="" loading="eager" />
        <div className="fm-works-hero-content">
        <p className="fm-pill">
          <Wrench size={14} aria-hidden="true" />
          Кейсы с поста
        </p>
        <h1>Выполненные работы</h1>
        <p className="fm-lead">
          Реальные ремонты с бокса: что беспокоило клиента, что нашли на диагностике и какой результат получили —
          с прозрачными сроками.
        </p>
        <div className="fm-actions">
          <Link className="fm-btn fm-btn-primary" to="/consult">
            <MessageSquare size={16} aria-hidden="true" />
            Описать свою проблему
          </Link>
          <Link className="fm-btn fm-btn-outline" to="/booking">
            Записаться в сервис
          </Link>
        </div>
        </div>
      </Reveal>

      <Reveal delay={80}>
        <div className="fm-stats fm-works-stats" aria-label="Статистика кейсов">
          <div>
            <strong>{works.length}</strong>
            <span>опубликованных кейсов</span>
          </div>
          <div>
            <strong>{CATEGORIES.length - 2}</strong>
            <span>направлений ремонта</span>
          </div>
          <div>
            <strong>{avgTermLabel}</strong>
            <span>типичный срок</span>
          </div>
          <div>
            <strong>
              <CheckCircle2 size={22} aria-hidden="true" />
            </strong>
            <span>итог подтверждает мастер</span>
          </div>
        </div>
      </Reveal>

      <Reveal delay={120} className="fm-works-toolbar">
        <div className="fm-works-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            placeholder="Поиск по авто, симптому или результату…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Поиск по кейсам"
          />
          {search ? (
            <button type="button" className="fm-works-search-clear" onClick={() => setSearch('')} aria-label="Очистить">
              <X size={16} />
            </button>
          ) : null}
        </div>

        <div className="fm-works-filters" role="tablist" aria-label="Фильтр по направлению">
          {CATEGORIES.map((cat) => {
            const count = cat.id === 'all' ? works.length : categoryCounts.get(cat.id) || 0;
            if (cat.id !== 'all' && count === 0) return null;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={categoryFilter === cat.id}
                className={`fm-works-filter${categoryFilter === cat.id ? ' is-active' : ''}`}
                onClick={() => setCategoryFilter(cat.id)}
              >
                {cat.label}
                <span className="fm-works-filter-count">{count}</span>
              </button>
            );
          })}
        </div>
      </Reveal>

      {loading ? <Loader /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!loading && filtered.length === 0 ? (
        <EmptyState
          description={
            search || categoryFilter !== 'all'
              ? 'По вашему запросу кейсов не найдено. Попробуйте другой фильтр или сбросьте поиск.'
              : 'Пока нет опубликованных кейсов.'
          }
        />
      ) : null}

      {!loading && filtered.length > 0 ? (
        <>
          <p className="fm-works-results" aria-live="polite">
            {filtered.length === works.length
              ? `Показаны все ${filtered.length} кейсов`
              : `Найдено ${filtered.length} из ${works.length}`}
          </p>

          {featured ? (
            <Reveal delay={60}>
              <WorkCaseCard item={featured} featured onOpen={setSelected} />
            </Reveal>
          ) : null}

          {rest.length > 0 ? (
            <div className="fm-works-grid">
              {rest.map((item, i) => (
                <Reveal key={item.id} delay={80 + (i % 3) * 60}>
                  <WorkCaseCard item={item} onOpen={setSelected} />
                </Reveal>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      <Reveal delay={100}>
        <section className="fm-dual-cta fm-works-cta">
          <article className="fm-card">
            <h3>Похожая проблема?</h3>
            <p>
              Опишите симптомы в ИИ-чате — получите предварительный разбор, оценку срочности и чек-лист проверок за
              2–4 минуты.
            </p>
            <Link className="fm-btn fm-btn-primary" to="/consult">
              Начать диагностику
            </Link>
          </article>
          <article className="fm-card fm-card-accent">
            <h3>Готовы к визиту?</h3>
            <p>Запишитесь на пост — мастер получит контекст из чата или выберите услугу из каталога.</p>
            <Link className="fm-btn fm-btn-outline" to="/booking">
              Записаться в сервис
            </Link>
          </article>
        </section>
      </Reveal>

      <WorkDetailModal item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
