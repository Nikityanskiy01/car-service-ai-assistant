import {
  ArrowRight,
  CalendarPlus,
  Home,
  Images,
  MapPinOff,
  MessageSquare,
  Phone,
  Wrench,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useProductConfig } from '../../config/ProductConfigProvider';
import { usePageMeta } from '../../hooks/usePageMeta';

const destinations = [
  {
    to: '/',
    label: 'Главная',
    desc: 'Вернуться на стартовую',
    icon: Home,
  },
  {
    to: '/services',
    label: 'Услуги',
    desc: 'Каталог работ и цен',
    icon: Wrench,
  },
  {
    to: '/consult',
    label: 'ИИ-диагностика',
    desc: 'Разбор симптомов онлайн',
    icon: MessageSquare,
    featured: true,
  },
  {
    to: '/booking',
    label: 'Записаться',
    desc: 'Выбрать время визита',
    icon: CalendarPlus,
  },
  {
    to: '/works',
    label: 'Наши работы',
    desc: 'Примеры ремонта',
    icon: Images,
  },
  {
    to: '/about',
    label: 'О сервисе',
    desc: 'Контакты и адрес',
    icon: Phone,
  },
] as const;

export function NotFoundPage() {
  const productConfig = useProductConfig();

  usePageMeta({
    title: 'Страница не найдена',
    description: 'Запрошенный раздел отсутствует или был перемещён.',
  });

  return (
    <section className="fm-not-found" aria-labelledby="not-found-title">
      <div className="fm-not-found__scene" aria-hidden="true">
        <p className="fm-not-found__watermark">404</p>
        <div className="fm-not-found__grid" />
        <div className="fm-not-found__glow" />
      </div>

      <div className="fm-not-found__layout">
        <div className="fm-not-found__hero">
          <p className="fm-not-found__code" aria-label="Ошибка 404">
            <span className="fm-not-found__digit">4</span>
            <span className="fm-not-found__digit fm-not-found__digit--zero">
              <span className="fm-not-found__zero-ring" aria-hidden="true" />
              0
            </span>
            <span className="fm-not-found__digit">4</span>
          </p>

          <p className="fm-not-found__badge">
            <MapPinOff size={15} aria-hidden="true" />
            Маршрут не найден
          </p>

          <h1 id="not-found-title">Здесь нет такой страницы</h1>
          <p className="fm-not-found__lead">
            Похоже, вы свернули не туда — как в навигаторе без сигнала. Выберите направление ниже или вернитесь
            на главную трассу.
          </p>

          <div className="fm-not-found__actions">
            <Link className="fm-btn fm-btn-primary fm-btn-lg" to="/">
              <Home size={17} aria-hidden="true" />
              На главную
            </Link>
            <Link className="fm-btn fm-btn-outline fm-btn-lg" to="/consult">
              <MessageSquare size={17} aria-hidden="true" />
              ИИ-диагностика
            </Link>
          </div>

          {productConfig.phone ? (
            <p className="fm-not-found__hotline">
              Нужна помощь?{' '}
              <a href={`tel:${productConfig.phone.replace(/\D/g, '')}`}>{productConfig.phone}</a>
            </p>
          ) : null}
        </div>

        <div className="fm-not-found__destinations">
          <div className="fm-not-found__dest-head">
            <h2>Куда дальше?</h2>
            <p>Популярные разделы сервиса</p>
          </div>

          <nav className="fm-not-found__cards" aria-label="Полезные разделы">
            {destinations.map((item) => {
              const { to, label, desc, icon: Icon } = item;
              const featured = 'featured' in item && item.featured;
              return (
              <Link
                key={to}
                to={to}
                className={`fm-not-found__card${featured ? ' is-featured' : ''}`}
              >
                <span className="fm-not-found__card-icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <span className="fm-not-found__card-body">
                  <strong>{label}</strong>
                  <span>{desc}</span>
                </span>
                <ArrowRight size={16} className="fm-not-found__card-arrow" aria-hidden="true" />
              </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </section>
  );
}
