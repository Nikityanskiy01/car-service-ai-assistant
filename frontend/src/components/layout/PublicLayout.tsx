import { Outlet } from 'react-router-dom';
import { Footer } from './Footer';
import { Header } from './Header';
import { PageContainer } from './PageContainer';

export function PublicLayout() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Перейти к содержимому
      </a>
      <Header />
      <PageContainer>
        <main id="main-content">
        <Outlet />
        </main>
      </PageContainer>
      <Footer />
    </>
  );
}
