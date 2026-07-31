import { Link } from 'react-router-dom';
import { NOT_PUBLIC_OFFER_NOTICE } from '../../config/legalTexts';
import { useProductConfig } from '../../config/ProductConfigProvider';

export function Footer() {
  const productConfig = useProductConfig();
  const { legal } = productConfig;
  const year = new Date().getFullYear();
  const phoneHref = productConfig.phone ? `tel:${productConfig.phone.replace(/[^\d+]/g, '')}` : undefined;
  const tagline = productConfig.footerCaption?.trim();

  return (
    <footer className="fm-footer">
      <div className="fm-footer-grid">
        <div className="fm-footer-brand">
          <p className="fm-footer-name">{productConfig.productName}</p>
          <p>{productConfig.description}</p>
          {tagline ? <p className="fm-footer-note-inline">{tagline}</p> : null}
        </div>

        <nav className="fm-footer-col" aria-label="Разделы сайта">
          <p className="fm-footer-label">Разделы</p>
          <Link to="/consult">ИИ-диагностика</Link>
          <Link to="/services">Услуги</Link>
          <Link to="/booking">Записаться</Link>
          <Link to="/works">Работы</Link>
          <Link to="/gallery">Галерея</Link>
          <Link to="/about">О сервисе</Link>
        </nav>

        <nav className="fm-footer-col" aria-label="Юридические документы">
          <p className="fm-footer-label">Документы</p>
          <Link to="/privacy">Политика обработки персональных данных</Link>
          <Link to="/terms">Пользовательское соглашение</Link>
        </nav>

        <div className="fm-footer-col">
          <p className="fm-footer-label">Контакты</p>
          <span>{productConfig.address}</span>
          {phoneHref ? <a href={phoneHref}>{productConfig.phone}</a> : null}
          {productConfig.supportEmail ? (
            <a href={`mailto:${productConfig.supportEmail}`}>{productConfig.supportEmail}</a>
          ) : null}
          <span>{productConfig.workingHours}</span>
        </div>
      </div>

      <div className="fm-footer-legal">
        <p>
          {legal.legalName}
          {legal.inn ? (
            <>
              {' '}
              · ИНН {legal.inn}
            </>
          ) : null}
          {legal.ogrn ? (
            <>
              {' '}
              · ОГРН {legal.ogrn}
            </>
          ) : null}
          {legal.legalAddress ? (
            <>
              {' '}
              · {legal.legalAddress}
            </>
          ) : null}
        </p>
      </div>

      <p className="fm-footer-disclaimer">{NOT_PUBLIC_OFFER_NOTICE}</p>

      <div className="fm-footer-bottom">
        <p className="fm-footer-meta">
          <span>
            © {year} {productConfig.shortName}
          </span>
          <span className="fm-footer-meta-sep" aria-hidden="true">
            ·
          </span>
          <Link to="/privacy">Политика обработки персональных данных</Link>
          <span className="fm-footer-meta-sep" aria-hidden="true">
            ·
          </span>
          <Link to="/terms">Пользовательское соглашение</Link>
        </p>
      </div>
    </footer>
  );
}
