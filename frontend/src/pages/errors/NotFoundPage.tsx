import { Link } from 'react-router-dom';
import { usePageMeta } from '../../hooks/usePageMeta';

export function NotFoundPage() {
  usePageMeta({
    title: 'Страница не найдена',
    description: 'Запрошенный раздел отсутствует или был перемещен.',
  });
  return (
    <div className="state-card">
      <h1>404</h1>
      <p>Страница не найдена.</p>
      <Link className="btn btn-primary" to="/">
        Перейти на главную
      </Link>
    </div>
  );
}
