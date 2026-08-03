import { ChevronDown, Cookie } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ACCEPT_ALL_COOKIE_DRAFT,
  DEFAULT_COOKIE_DRAFT,
  hasCookieConsentDecision,
  saveCookieConsent,
  type CookieConsentDraft,
} from '../../lib/cookieConsent';

type CategoryConfig = {
  id: keyof CookieConsentDraft;
  label: string;
  hint: string;
};

const CATEGORIES: CategoryConfig[] = [
  {
    id: 'functional',
    label: 'Функциональные',
    hint: 'Запоминают настройки и улучшают удобство работы с сайтом.',
  },
  {
    id: 'analytics',
    label: 'Статистические',
    hint: 'Помогают понять, как используется сервис, без персональных профилей.',
  },
  {
    id: 'marketing',
    label: 'Маркетинговые',
    hint: 'Показывают релевантные предложения на других площадках.',
  },
];

function CookieToggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange?: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      className={`cookie-toggle${checked ? ' is-on' : ''}${disabled ? ' is-disabled' : ''}`}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
    >
      <span className="cookie-toggle__thumb" aria-hidden="true" />
    </button>
  );
}

export function CookieBanner() {
  const titleId = useId();
  const detailsId = useId();
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [draft, setDraft] = useState<CookieConsentDraft>(DEFAULT_COOKIE_DRAFT);

  useEffect(() => {
    setVisible(!hasCookieConsentDecision());
  }, []);

  function closeWithConsent(next: CookieConsentDraft) {
    saveCookieConsent(next);
    setVisible(false);
  }

  function acceptAll() {
    closeWithConsent(ACCEPT_ALL_COOKIE_DRAFT);
  }

  function rejectAll() {
    closeWithConsent(DEFAULT_COOKIE_DRAFT);
  }

  function saveSelection() {
    closeWithConsent(draft);
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="presentation">
      <div className="cookie-banner__backdrop" aria-hidden="true" />
      <section
        className="cookie-banner__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={`${titleId}-desc`}
      >
        <header className="cookie-banner__head">
          <div className="cookie-banner__title-row">
            <span className="cookie-banner__icon" aria-hidden="true">
              <Cookie size={18} />
            </span>
            <h2 id={titleId} className="cookie-banner__title">
              Этот сайт использует cookie
            </h2>
          </div>
          <p id={`${titleId}-desc`} className="cookie-banner__text">
            Мы применяем cookie и похожие технологии для авторизации, безопасности сессии и корректной работы
            сервиса. Нажимая «Принять всё», вы соглашаетесь на их сохранение на вашем устройстве.
          </p>
          <Link className="cookie-banner__policy" to="/privacy">
            Политика обработки персональных данных
          </Link>
        </header>

        <div className="cookie-banner__actions">
          <div className="cookie-banner__action-row">
            <button type="button" className="cookie-banner__btn cookie-banner__btn--ghost" onClick={rejectAll}>
              Отклонить всё
            </button>
            <button type="button" className="cookie-banner__btn cookie-banner__btn--primary" onClick={acceptAll}>
              Принять всё
            </button>
          </div>
          <button
            type="button"
            className={`cookie-banner__details-toggle${showDetails ? ' is-open' : ''}`}
            aria-expanded={showDetails}
            aria-controls={detailsId}
            onClick={() => setShowDetails((open) => !open)}
          >
            {showDetails ? 'Скрыть детали' : 'Показать детали'}
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </div>

        <div
          id={detailsId}
          className={`cookie-banner__details${showDetails ? ' is-open' : ''}`}
          hidden={!showDetails}
        >
          <div className="cookie-banner__categories" role="group" aria-label="Категории cookie">
            <article className="cookie-banner__category cookie-banner__category--required">
              <div className="cookie-banner__category-head">
                <h3>Технически необходимые</h3>
                <span className="cookie-banner__badge">Всегда активны</span>
              </div>
              <p>Нужны для входа, безопасности и базовой работы сайта.</p>
              <CookieToggle checked disabled label="Технически необходимые cookie" />
            </article>

            {CATEGORIES.map((category) => (
              <article key={category.id} className="cookie-banner__category">
                <div className="cookie-banner__category-head">
                  <h3>{category.label}</h3>
                </div>
                <p>{category.hint}</p>
                <CookieToggle
                  checked={draft[category.id]}
                  label={`${category.label} cookie`}
                  onChange={(next) => setDraft((prev) => ({ ...prev, [category.id]: next }))}
                />
              </article>
            ))}
          </div>

          <button type="button" className="cookie-banner__btn cookie-banner__btn--secondary" onClick={saveSelection}>
            Сохранить выбор
          </button>
        </div>
      </section>
    </div>
  );
}
