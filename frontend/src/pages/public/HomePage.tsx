import {
  AlertTriangle,
  Calculator,
  ClipboardList,
  Cpu,
  Eye,
  History,
  MessageSquare,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { FaqAccordion } from '../../components/public/FaqAccordion';
import { ServicesShowcase } from '../../components/services/ServicesShowcase';
import { SiteImage } from '../../components/ui/SiteImage';
import { useProductConfig } from '../../config/ProductConfigProvider';
import { siteImages, workImageAt } from '../../content/siteImages';
import { useServices } from '../../features/services/useServices';
import { useAsyncState } from '../../hooks/useAsyncState';
import { usePageMeta } from '../../hooks/usePageMeta';
import { cachedPublicFetch } from '../../lib/publicContentCache';

const outcomes = [
  {
    icon: Search,
    title: 'Вероятные причины',
    text: 'ИИ определяет наиболее вероятные причины по вашим симптомам',
  },
  {
    icon: AlertTriangle,
    title: 'Срочность обращения',
    text: 'Оценка приоритета: ехать в сервис сегодня или можно подождать',
  },
  {
    icon: ClipboardList,
    title: 'Чек-лист проверок',
    text: 'Список того, что нужно проверить до или во время записи',
  },
  {
    icon: Calculator,
    title: 'Оценка стоимости',
    text: 'Примерная стоимость работ на основе типовых расценок',
  },
];

const steps = [
  { title: 'Опишите авто и проблему', text: 'Марка, модель, пробег и симптомы своими словами — без спецтерминов.' },
  { title: 'ИИ задаёт уточнения', text: 'Короткие вопросы по режиму работы, звукам, индикаторам и срочности.' },
  { title: 'Предварительный результат', text: 'Вероятные причины, что проверить и ориентир по стоимости.' },
  { title: 'Заявка в сервис', text: 'Одним шагом передайте отчёт мастеру и запишитесь на пост.' },
];

const trust = [
  {
    icon: Eye,
    title: 'Прозрачный результат',
    text: 'Показываем причины, вероятности и следующий шаг, а не абстрактные советы.',
  },
  {
    icon: Cpu,
    title: 'Связка ИИ + мастера',
    text: 'ИИ ускоряет первичную оценку, а окончательный вывод делает специалист на диагностике.',
  },
  {
    icon: History,
    title: 'Единая история обращения',
    text: 'Диалог, отчёт и заявка сохраняются в кабинете для понятного сопровождения ремонта.',
  },
];

const faqs = [
  {
    q: 'ИИ ставит окончательный диагноз?',
    a: 'Нет. Чат даёт предварительный ориентир и чек-лист. Точный диагноз — после осмотра на посту.',
  },
  {
    q: 'Нужна ли регистрация для консультации?',
    a: 'Нет. Можно начать сразу. Аккаунт нужен, если хотите сохранить историю и статусы заявок.',
  },
  {
    q: 'Можно сразу записаться после чата?',
    a: 'Да. Из консультации или с главной можно оставить заявку с удобным временем записьа.',
  },
];

const fallbackWorks = [
  {
    id: 'fw1',
    title: 'Toyota Camry 2018 — вибрация при торможении',
    imageUrl: siteImages.works.brakes,
    problem: 'Вибрация при торможении',
    term: '1 день',
  },
  {
    id: 'fw2',
    title: 'Kia Rio 2019 — стук на кочках',
    imageUrl: siteImages.works.suspension,
    problem: 'Стук на кочках',
    term: '2 дня',
  },
  {
    id: 'fw3',
    title: 'Hyundai Solaris — плановое ТО',
    imageUrl: siteImages.works.service,
    problem: 'Регламент 90 000 км',
    term: 'в день обращения',
  },
];

interface CmsWork {
  id: string;
  title: string;
  problem?: string;
  result?: string;
  term?: string;
  imageUrl?: string;
}

export function HomePage() {
  const productConfig = useProductConfig();
  usePageMeta({
    title: 'ИИ-диагностика и автосервис',
    description: productConfig.description,
    preloadImage: siteImages.hero.home,
  });

  const worksState = useAsyncState<CmsWork[]>(() =>
    cachedPublicFetch('site-items:work', () => api('/content/site-items?kind=work')),
  );
  const { services, count: servicesCount } = useServices();

  const works = (worksState.data?.length ? worksState.data : fallbackWorks).slice(0, 3);

  return (
    <div className="fm-home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'AutoRepair',
            name: productConfig.productName,
            description: productConfig.description,
            telephone: productConfig.phone,
            email: productConfig.supportEmail,
            address: productConfig.address
              ? { '@type': 'PostalAddress', streetAddress: productConfig.address }
              : undefined,
          }),
        }}
      />
      <section className="fm-hero" aria-label="Главный экран">
        <div className="fm-hero-copy">
          <p className="fm-brand-hero">{productConfig.productName}</p>
          <p className="fm-pill">
            <MessageSquare size={14} aria-hidden="true" />
            ИИ-ассистент диагностики автомобиля
          </p>
          <h1>Узнайте причину неисправности автомобиля за 2–4 минуты</h1>
          <p className="fm-lead">
            Онлайн-чат с «{productConfig.assistantName}» помогает определить вероятные причины, подсказывает что
            проверить, оценивает срочность и даёт предварительную стоимость — затем можно сразу записаться в сервис.
          </p>
          <ul className="fm-bullets">
            <li>Вероятные причины неисправности</li>
            <li>Список проверок перед ремонтом</li>
            <li>Оценка срочности обращения</li>
            <li>Предварительная стоимость работ</li>
          </ul>
          <div className="fm-actions">
            <Link className="fm-btn fm-btn-primary fm-btn-lg" to="/consult">
              Начать диагностику
            </Link>
            <Link className="fm-btn fm-btn-outline fm-btn-lg" to="/booking">
              Записаться в сервис
            </Link>
          </div>
          <p className="fm-meta">Без регистрации · результат за 2–4 минуты · сохранение отчёта</p>
          <div className="fm-text-links">
            <Link to="/works">Смотреть наши работы</Link>
            <Link to="/gallery">Посмотреть галерею сервиса</Link>
          </div>
        </div>

        <aside className="fm-hero-visual" aria-label="Пример консультации">
          <SiteImage
            className="fm-hero-photo"
            src={siteImages.hero.home}
            alt=""
            priority
            width={1536}
            height={1024}
          />
          <div className="fm-chat-card">
            <div className="fm-chat-head">
              <div className="fm-chat-head-main">
                <span className="fm-chat-avatar" aria-hidden>
                  <MessageSquare size={16} />
                </span>
                <div>
                  <p className="fm-chat-title">{productConfig.assistantName}</p>
                  <p className="fm-chat-sub">
                    <span className="fm-online">
                      <i />
                      в сети
                    </span>
                    <span className="fm-chat-sub-sep" aria-hidden>
                      ·
                    </span>
                    обычно отвечает за минуту
                  </p>
                </div>
              </div>
            </div>

            <div className="fm-chat-thread">
              <div className="fm-bubble fm-bubble-bot">
                <p>Опишите марку, модель, пробег и симптомы.</p>
                <time dateTime="09:41">09:41</time>
              </div>
              <div className="fm-bubble fm-bubble-user fm-bubble-highlight">
                <p>Kia Rio 2018, 132&nbsp;000 км. При торможении идёт вибрация в руль.</p>
                <time dateTime="09:41">09:41</time>
              </div>
              <div className="fm-bubble fm-bubble-bot">
                <p>Вибрация появляется на высокой скорости или в любом режиме?</p>
                <time dateTime="09:42">09:42</time>
              </div>
              <div className="fm-mini-result">
                <strong>Предварительный разбор</strong>
                <span>Вероятен износ тормозных дисков, нужна проверка суппортов.</span>
                <span className="fm-urgency">Срочность: диагностика в ближайшие 1–2 дня.</span>
              </div>
              <div className="fm-chat-typing" aria-hidden>
                <span />
                <span />
                <span />
              </div>
            </div>

            <Link className="fm-chat-composer" to="/consult" aria-label="Открыть чат диагностики">
              <span className="fm-chat-composer-input">Опишите симптомы…</span>
              <span className="fm-chat-composer-send" aria-hidden>
                →
              </span>
            </Link>
          </div>
        </aside>
      </section>

      <section className="fm-stats" aria-label="Ориентиры сервиса">
        <div>
          <strong>2–4 мин</strong>
          <span>до предварительного разбора</span>
        </div>
        <div>
          <strong>{servicesCount}</strong>
          <span>услуг в каталоге</span>
        </div>
        <div>
          <strong>24/7</strong>
          <span>доступ к ИИ-чату</span>
        </div>
        <div>
          <strong>
            <ShieldCheck size={22} aria-hidden="true" />
          </strong>
          <span>итог подтверждает мастер</span>
        </div>
      </section>

      <section className="fm-section">
        <h2>Что вы получаете после консультации</h2>
        <div className="fm-grid-4">
          {outcomes.map((item) => (
            <article key={item.title} className="fm-card">
              <span className="fm-icon" aria-hidden="true">
                <item.icon size={22} />
              </span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="fm-section">
        <div className="fm-section-row">
          <h2>Как работает система</h2>
          <Link className="fm-btn fm-btn-primary" to="/consult">
            Начать консультацию
          </Link>
        </div>
        <div className="fm-grid-4">
          {steps.map((item, i) => (
            <article key={item.title} className="fm-card fm-step">
              <span className="fm-step-badge">Шаг {i + 1}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="fm-section">
        <h2>Почему нам доверяют</h2>
        <div className="fm-grid-3">
          {trust.map((item) => (
            <article key={item.title} className="fm-card">
              <span className="fm-icon" aria-hidden="true">
                <item.icon size={22} />
              </span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="fm-section">
        <div className="fm-section-row">
          <h2>Примеры выполненных работ</h2>
          <Link className="fm-btn fm-btn-outline" to="/works">
            Наши работы
          </Link>
        </div>
        <div className="fm-grid-3">
          {works.map((item) => (
            <article key={item.id} className="fm-work-card">
              <SiteImage src={workImageAt(item.imageUrl)} alt="" />
              <div className="fm-work-body">
                <p>{item.title}</p>
                <span>
                  {[item.problem, item.term].filter(Boolean).join(' · ') || 'Кейс с поста'}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <ServicesShowcase services={services} />

      <section className="fm-section">
        <div>
          <h2>Частые вопросы</h2>
          <p className="fm-section-desc">Коротко о консультации, регистрации и записи в сервис</p>
        </div>
        <FaqAccordion items={faqs} />
      </section>

      <section className="fm-section">
        <h2>Расположение сервиса</h2>
        <div className="fm-location">
          <div className="fm-card">
            <dl className="fm-facts">
              <div>
                <dt>Адрес</dt>
                <dd>{productConfig.address}</dd>
              </div>
              <div>
                <dt>Телефон</dt>
                <dd>
                  {productConfig.phone ? (
                    <a href={`tel:${productConfig.phone.replace(/[^\d+]/g, '')}`}>{productConfig.phone}</a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt>Режим работы</dt>
                <dd>{productConfig.workingHours}</dd>
              </div>
            </dl>
            <Link className="fm-btn fm-btn-outline" to="/about">
              Открыть контакты
            </Link>
          </div>
          <div className="fm-map">
            <SiteImage className="fm-map-photo" src={siteImages.gallery.shopfloor} alt="" />
            {productConfig.mapUrl ? (
              <a className="fm-map-frame" href={productConfig.mapUrl} target="_blank" rel="noreferrer">
                <span>Открыть карту</span>
                <small>{productConfig.address}</small>
              </a>
            ) : (
              <div className="fm-map-frame">
                <span>Карта</span>
                <small>{productConfig.address}</small>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="fm-section fm-dual-cta">
        <article className="fm-card">
          <h3>Записаться в сервис</h3>
          <p>Выберите услугу из каталога и оставьте удобное время — регистрация не обязательна.</p>
          <Link className="fm-btn fm-btn-primary" to="/booking">
            Записаться в сервис
          </Link>
        </article>
        <article className="fm-card fm-card-accent">
          <h3>ИИ-диагностика</h3>
          <p>Опишите симптомы — ассистент подготовит предварительный разбор, оценку срочности и план действий.</p>
          <Link className="fm-btn fm-btn-outline" to="/consult">
            Начать диагностику
          </Link>
        </article>
      </section>
    </div>
  );
}
