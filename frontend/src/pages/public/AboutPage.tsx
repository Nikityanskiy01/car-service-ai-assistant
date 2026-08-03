import {
  Car,
  Clock,
  Cpu,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { ConsentCheckbox } from '../../components/forms/ConsentCheckbox';
import { FormField } from '../../components/forms/FormField';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { FaqAccordion } from '../../components/public/FaqAccordion';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SiteImage } from '../../components/ui/SiteImage';
import { Textarea } from '../../components/ui/Textarea';
import { useProductConfig } from '../../config/ProductConfigProvider';
import { siteImages } from '../../content/siteImages';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getFullNameError, getPhoneError } from '../../lib/validation';

type ContactFieldErrors = {
  fullName?: string;
  phone?: string;
};

const values = [
  {
    icon: Cpu,
    title: 'ИИ + мастер на посту',
    text: 'Онлайн-диагностика ускоряет первичный разбор, а окончательный вывод и ремонт делает специалист.',
  },
  {
    icon: ShieldCheck,
    title: 'Прозрачные сметы',
    text: 'Согласовываем объём работ до начала ремонта. Без скрытых позиций и навязанных услуг.',
  },
  {
    icon: Wrench,
    title: 'Полный цикл',
    text: 'Диагностика, ремонт, ТО и электрика — всё в одном сервисе с единой историей обращения.',
  },
];

const workflow = [
  {
    title: 'Записаться или консультация',
    text: 'Запишитесь онлайн или начните с ИИ-чата, если симптом пока неясен.',
  },
  {
    title: 'Приём и диагностика',
    text: 'Мастер осматривает авто, сверяет данные из чата и подтверждает план работ.',
  },
  {
    title: 'Согласование и ремонт',
    text: 'Утверждаем смету, выполняем работы и держим в курсе статуса в личном кабинете.',
  },
  {
    title: 'Выдача и рекомендации',
    text: 'Передаём авто с отчётом, рекомендациями по эксплуатации и напоминанием о следующем ТО.',
  },
];

const guarantees = [
  {
    icon: Car,
    title: 'Любые марки',
    text: 'Работаем с иномарками и отечественными авто — от планового ТО до сложной электрики.',
  },
  {
    icon: Users,
    title: 'Опытные мастера',
    text: 'Каждый пост ведёт профильный специалист с практикой диагностики и ремонта.',
  },
  {
    icon: Sparkles,
    title: 'Современное оборудование',
    text: 'Компьютерная диагностика, подъёмники и инструмент для точной проверки узлов.',
  },
];

const visitFaqs = [
  {
    q: 'Нужно ли записываться заранее?',
    a: 'Рекомендуем онлайн-запись — так мастер будет готов к приёму. Срочные случаи обсуждаем по телефону.',
  },
  {
    q: 'Можно приехать без ИИ-консультации?',
    a: 'Да. Чат помогает подготовиться к записи, но не обязателен — мастер проведёт диагностику на месте.',
  },
  {
    q: 'Как добраться и где парковка?',
    a: 'Адрес и маршрут — на карте ниже. Рядом с сервисом обычно есть место для кратковременной парковки.',
  },
  {
    q: 'Сколько ждать ответ на сообщение?',
    a: 'На заявку с сайта отвечаем в рабочие часы, обычно в течение 1–2 часов.',
  },
];

function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function AboutPage() {
  const productConfig = useProductConfig();
  usePageMeta({
    title: 'О сервисе и контакты',
    description: `Контакты, режим работы и форма связи — ${productConfig.productName}`,
    preloadImage: siteImages.hero.about,
  });

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({});
  const [status, setStatus] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: ContactFieldErrors = {};
    const nameError = getFullNameError(fullName);
    if (nameError) nextErrors.fullName = nameError;
    const phoneError = getPhoneError(phone);
    if (phoneError) nextErrors.phone = phoneError;
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (!consent) {
      setConsentError('Отметьте согласие на обработку персональных данных');
      return;
    }
    setConsentError(null);
    setLoading(true);
    setStatus(null);
    setStatusError(false);
    try {
      await api('/contact', {
        method: 'POST',
        body: { fullName, phone, message, consentPersonalData: true, source: 'about_page' },
        skipAuthRefresh: true,
      });
      setStatus('Сообщение отправлено. Мы свяжемся с вами в ближайшее время.');
      setFullName('');
      setPhone('');
      setMessage('');
      setConsent(false);
    } catch (error) {
      setStatusError(true);
      setStatus(error instanceof Error ? error.message : 'Не удалось отправить сообщение.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fm-about">
      <section className="fm-about-hero" aria-label="О сервисе">
        <div className="fm-about-hero-copy">
          <p className="fm-pill">
            <MessageSquare size={14} aria-hidden="true" />
            О сервисе и контакты
          </p>
          <h1>Сервис, где технологии помогают, а решения принимает мастер</h1>
          <p className="fm-lead">
            {productConfig.productName} — это ремонт, ТО и онлайн ИИ-диагностика в одном месте. Мы сочетаем
            быстрый предварительный разбор с очным осмотром, чтобы вы заранее понимали причину, срочность и
            ориентир по стоимости.
          </p>
          <ul className="fm-bullets">
            <li>Онлайн-запись без обязательной регистрации</li>
            <li>ИИ-ассистент «{productConfig.assistantName}» доступен 24/7</li>
            <li>Единая история: чат, заявка и статус ремонта в кабинете</li>
            <li>Итоговый диагноз подтверждает специалист на посту</li>
          </ul>
          <div className="fm-actions">
            <Link className="fm-btn fm-btn-primary fm-btn-lg" to="/booking">
              Записаться в сервис
            </Link>
            <Link className="fm-btn fm-btn-outline fm-btn-lg" to="/consult">
              Начать ИИ-диагностику
            </Link>
          </div>
        </div>

        <aside className="fm-about-hero-aside" aria-label="Контакты сервиса">
          <div className="fm-about-hero-photo">
            <SiteImage src={siteImages.hero.about} alt="Автосервис" priority />
          </div>
          <div className="fm-about-quick-card">
          <p className="fm-about-quick-title">Быстрые контакты</p>
          <ul className="fm-about-quick-list">
            <li>
              <MapPin size={18} aria-hidden="true" />
              <div>
                <span>Адрес</span>
                <strong>{productConfig.address || '—'}</strong>
              </div>
            </li>
            <li>
              <Clock size={18} aria-hidden="true" />
              <div>
                <span>Режим</span>
                <strong>{productConfig.workingHours}</strong>
              </div>
            </li>
            <li>
              <Phone size={18} aria-hidden="true" />
              <div>
                <span>Телефон</span>
                <strong>
                  {productConfig.phone ? (
                    <a href={phoneHref(productConfig.phone)}>{productConfig.phone}</a>
                  ) : (
                    '—'
                  )}
                </strong>
              </div>
            </li>
            <li>
              <Mail size={18} aria-hidden="true" />
              <div>
                <span>Почта</span>
                <strong>
                  {productConfig.supportEmail ? (
                    <a href={`mailto:${productConfig.supportEmail}`}>{productConfig.supportEmail}</a>
                  ) : (
                    '—'
                  )}
                </strong>
              </div>
            </li>
          </ul>
          {productConfig.mapUrl ? (
            <a className="fm-about-map-link" href={productConfig.mapUrl} target="_blank" rel="noreferrer">
              Открыть маршрут в картах →
            </a>
          ) : null}
          </div>
        </aside>
      </section>

      <section className="fm-stats" aria-label="Ориентиры сервиса">
        <div>
          <strong>10+</strong>
          <span>лет опыта команды</span>
        </div>
        <div>
          <strong>6</strong>
          <span>постов обслуживания</span>
        </div>
        <div>
          <strong>24/7</strong>
          <span>ИИ-консультация онлайн</span>
        </div>
        <div>
          <strong>
            <ShieldCheck size={22} aria-hidden="true" />
          </strong>
          <span>гарантия на работы</span>
        </div>
      </section>

      <section className="fm-section">
        <h2>Наш подход</h2>
        <div className="fm-grid-3">
          {values.map((item) => (
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
          <h2>Как проходит запись</h2>
          <Link className="fm-btn fm-btn-outline" to="/booking">
            Записаться
          </Link>
        </div>
        <div className="fm-grid-4">
          {workflow.map((item, index) => (
            <article key={item.title} className="fm-card fm-step">
              <span className="fm-step-badge">Шаг {index + 1}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="fm-section">
        <h2>Почему выбирают нас</h2>
        <div className="fm-grid-3">
          {guarantees.map((item) => (
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

      <section className="fm-photo-strip" aria-label="Фото сервиса">
        <SiteImage src={siteImages.gallery.reception} alt="Зона приёма клиентов" />
        <SiteImage src={siteImages.gallery.bay} alt="Пост на подъёмнике" />
        <SiteImage src={siteImages.gallery.ready} alt="Выдача автомобиля" />
      </section>

      <section className="fm-section" id="contacts">
        <h2>Контакты и как нас найти</h2>
        <div className="fm-about-contact-hub">
          <div className="fm-about-contact-side">
            <div className="fm-about-contact-cards">
              <article className="fm-about-contact-item">
                <span className="fm-icon" aria-hidden="true">
                  <MapPin size={20} />
                </span>
                <div>
                  <h3>Адрес</h3>
                  <p>{productConfig.address || '—'}</p>
                </div>
              </article>
              <article className="fm-about-contact-item">
                <span className="fm-icon" aria-hidden="true">
                  <Phone size={20} />
                </span>
                <div>
                  <h3>Телефон</h3>
                  <p>
                    {productConfig.phone ? (
                      <a href={phoneHref(productConfig.phone)}>{productConfig.phone}</a>
                    ) : (
                      '—'
                    )}
                  </p>
                </div>
              </article>
              <article className="fm-about-contact-item">
                <span className="fm-icon" aria-hidden="true">
                  <Mail size={20} />
                </span>
                <div>
                  <h3>Электронная почта</h3>
                  <p>
                    {productConfig.supportEmail ? (
                      <a href={`mailto:${productConfig.supportEmail}`}>{productConfig.supportEmail}</a>
                    ) : (
                      '—'
                    )}
                  </p>
                </div>
              </article>
              <article className="fm-about-contact-item">
                <span className="fm-icon" aria-hidden="true">
                  <Clock size={20} />
                </span>
                <div>
                  <h3>Режим работы</h3>
                  <p>{productConfig.workingHours}</p>
                </div>
              </article>
            </div>

            <div className="fm-actions">
              <Link className="fm-btn fm-btn-primary" to="/booking">
                Записаться
              </Link>
              <Link className="fm-btn fm-btn-outline" to="/consult">
                ИИ-диагностика
              </Link>
              {productConfig.phone ? (
                <a className="fm-btn fm-btn-outline" href={phoneHref(productConfig.phone)}>
                  Позвонить
                </a>
              ) : null}
            </div>

            <div className="fm-map">
              {productConfig.mapUrl ? (
                <a className="fm-map-frame fm-map-frame-rich" href={productConfig.mapUrl} target="_blank" rel="noreferrer">
                  <MapPin size={28} aria-hidden="true" />
                  <span>Открыть карту и маршрут</span>
                  <small>{productConfig.address}</small>
                </a>
              ) : (
                <div className="fm-map-frame fm-map-frame-rich">
                  <MapPin size={28} aria-hidden="true" />
                  <span>Карта</span>
                  <small>{productConfig.address}</small>
                </div>
              )}
            </div>
          </div>

          <section className="fm-card fm-card-static fm-about-form-card" aria-labelledby="contact-form-title">
            <h2 id="contact-form-title">Написать нам</h2>
            <p className="fm-about-form-lead">
              Оставьте вопрос о ремонте, записи или сотрудничестве — ответим в рабочие часы.
            </p>
            <form className="fm-form stack" onSubmit={onSubmit} noValidate>
              <FormField
                label="Имя"
                htmlFor="contactName"
                hint="Как к вам обращаться при ответе"
                error={fieldErrors.fullName}
              >
                <Input
                  name="fullName"
                  autoComplete="name"
                  placeholder="Иван Иванов"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (fieldErrors.fullName) setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
                  }}
                  required
                />
              </FormField>
              <FormField
                label="Телефон"
                htmlFor="contactPhone"
                hint="Перезвоним или напишем в мессенджер"
                error={fieldErrors.phone}
              >
                <PhoneInput
                  name="phone"
                  value={phone}
                  onChange={(value) => {
                    setPhone(value);
                    if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  required
                />
              </FormField>
              <FormField label="Сообщение" htmlFor="contactMessage" hint="Необязательно — опишите вопрос или удобное время">
                <Textarea
                  id="contactMessage"
                  name="message"
                  rows={5}
                  placeholder="Опишите вопрос или удобное время для звонка"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </FormField>
              <ConsentCheckbox
                id="contactConsent"
                checked={consent}
                onChange={(v) => {
                  setConsent(v);
                  if (v) setConsentError(null);
                }}
                error={consentError}
              />
              <Button type="submit" disabled={loading}>
                {loading ? 'Отправка...' : 'Отправить сообщение'}
              </Button>
              {status ? (
                <p className={statusError ? 'form-status is-error' : 'form-status is-success'} role="status">
                  {status}
                </p>
              ) : null}
            </form>
          </section>
        </div>
      </section>

      <section className="fm-section">
        <div>
          <h2>Вопросы перед записью</h2>
          <p className="fm-section-desc">Что важно знать до приезда в сервис</p>
        </div>
        <FaqAccordion items={visitFaqs} />
      </section>

      <section className="fm-section fm-dual-cta">
        <article className="fm-card">
          <h3>Записаться в сервис</h3>
          <p>Выберите услугу и удобное время — регистрация не обязательна.</p>
          <Link className="fm-btn fm-btn-primary" to="/booking">
            Записаться в сервис
          </Link>
        </article>
        <article className="fm-card fm-card-accent">
          <h3>ИИ-диагностика</h3>
          <p>Опишите симптомы — ассистент подготовит предварительный разбор и план действий.</p>
          <Link className="fm-btn fm-btn-outline" to="/consult">
            Начать диагностику
          </Link>
        </article>
      </section>
    </div>
  );
}
