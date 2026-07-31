import { ArrowRight, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useProductConfig } from '../../config/ProductConfigProvider';
import { usePageMeta } from '../../hooks/usePageMeta';
import {
  STATUS_ERROR_CATALOG,
  type StatusErrorCode,
  type StatusErrorConfig,
} from './statusErrorCatalog';

function StatusDigits({ code }: { code: number }) {
  const digits = String(code).split('');
  return (
    <p className="fm-not-found__code" aria-label={`Ошибка ${code}`}>
      {digits.map((digit, index) =>
        digit === '0' ? (
          <span key={`${digit}-${index}`} className="fm-not-found__digit fm-not-found__digit--zero">
            <span className="fm-not-found__zero-ring" aria-hidden="true" />
            0
          </span>
        ) : (
          <span key={`${digit}-${index}`} className="fm-not-found__digit">
            {digit}
          </span>
        ),
      )}
    </p>
  );
}

export function StatusErrorPage({
  code,
  config: configOverride,
}: {
  code: StatusErrorCode;
  config?: Partial<StatusErrorConfig>;
}) {
  const productConfig = useProductConfig();
  const base = STATUS_ERROR_CATALOG[code];
  const config = { ...base, ...configOverride };
  const BadgeIcon = config.icon as LucideIcon;

  usePageMeta({
    title: config.metaTitle,
    description: config.metaDescription,
  });

  return (
    <section className="fm-not-found fm-status-error" aria-labelledby="status-error-title" data-status={code}>
      <div className="fm-not-found__scene" aria-hidden="true">
        <p className="fm-not-found__watermark">{code}</p>
        <div className="fm-not-found__grid" />
        <div className="fm-not-found__glow" />
      </div>

      <div className="fm-not-found__layout">
        <div className="fm-not-found__hero">
          <StatusDigits code={code} />

          <p className="fm-not-found__badge">
            <BadgeIcon size={15} aria-hidden="true" />
            {config.badge}
          </p>

          <h1 id="status-error-title">{config.title}</h1>
          <p className="fm-not-found__lead">{config.lead}</p>

          <div className="fm-not-found__actions">
            {config.actions.map((action) => {
              const className = `fm-btn fm-btn-${action.variant === 'primary' ? 'primary' : 'outline'} fm-btn-lg`;
              if (action.reload) {
                return (
                  <button
                    key={action.label}
                    type="button"
                    className={className}
                    onClick={() => window.location.reload()}
                  >
                    {action.label}
                  </button>
                );
              }
              return (
                <Link key={action.to + action.label} className={className} to={action.to}>
                  {action.label}
                </Link>
              );
            })}
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
            <h2>{config.panelTitle}</h2>
            <p>{config.panelSubtitle}</p>
          </div>

          <ul className="fm-status-error__tips" aria-label="Подсказки">
            {config.tips.map((tip) => (
              <li key={tip} className="fm-status-error__tip">
                <span className="fm-status-error__tip-icon" aria-hidden="true">
                  <ArrowRight size={16} />
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
