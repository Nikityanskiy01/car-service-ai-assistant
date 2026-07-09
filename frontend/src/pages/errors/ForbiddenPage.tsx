import { Link } from 'react-router-dom';
import { usePageMeta } from '../../hooks/usePageMeta';

export function ForbiddenPage() {
  usePageMeta({
    title: 'Доступ ограничен',
    description: 'Недостаточно прав для просмотра этого раздела.',
  });
  return (
    <div className="state-card">
      <h1>403</h1>
      <p>Недостаточно прав для просмотра этой страницы.</p>
      <Link className="btn btn-primary" to="/">
        На главную
      </Link>
    </div>
  );
}
