import { Outlet } from 'react-router-dom';
import { CookieBanner } from './CookieBanner';
import { Footer } from './Footer';
import { Header } from './Header';

export function PublicLayout() {
  return (
    <div className="fm-shell">
      <a href="#main-content" className="skip-link">
        Перейти к содержимому
      </a>
      <Header />
      <main id="main-content" className="fm-main">
        <Outlet />
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
}
