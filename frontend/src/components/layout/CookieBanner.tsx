import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'car_service_cookie_notice';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(STORAGE_KEY) !== 'accepted');
    } catch {
      setVisible(true);
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, 'accepted');
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fm-cookie-banner" role="dialog" aria-live="polite" aria-label="Уведомление о cookie">
      <div className="fm-cookie-banner-inner">
        <p>
          Сайт использует файлы cookie и аналогичные технологии для авторизации, безопасности сессии и корректной
          работы сервиса. Подробнее — в{' '}
          <Link to="/privacy">Политике обработки персональных данных</Link>.
        </p>
        <button type="button" className="fm-btn fm-btn-primary fm-cookie-banner-btn" onClick={accept}>
          Понятно
        </button>
      </div>
    </div>
  );
}
