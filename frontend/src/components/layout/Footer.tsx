import { Link } from 'react-router-dom';
import { useProductConfig } from '../../config/ProductConfigProvider';

export function Footer() {
  const productConfig = useProductConfig();
  const year = new Date().getFullYear();
  const phoneHref = productConfig.phone ? `tel:${productConfig.phone.replace(/[^\d+]/g, '')}` : undefined;

  return (
    <footer className="fm-footer">
      <div className="fm-footer-grid">
        <div className="fm-footer-brand">
          <p className="fm-footer-name">{productConfig.productName}</p>
          <p>{productConfig.description}</p>
          <p className="fm-footer-note-inline">{productConfig.footerCaption}</p>
        </div>

        <nav className="fm-footer-col" aria-label="Разделы сайта">
          <p className="fm-footer-label">Разделы</p>
          <Link to="/consult">ИИ-диагностика</Link>
          <Link to="/services">Услуги</Link>
          <Link to="/booking">Запись</Link>
          <Link to="/works">Работы</Link>
          <Link to="/gallery">Галерея</Link>
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

      <div className="fm-footer-bottom">
        <p>
          © {year} {productConfig.shortName}
        </p>
        <nav className="fm-footer-nav" aria-label="Подвал">
          <Link to="/about">О сервисе и контакты</Link>
          <Link to="/privacy">Политика ПДн</Link>
          <Link to="/terms">Соглашение</Link>
          <Link to="/login">Вход</Link>
        </nav>
      </div>
    </footer>
  );
}
