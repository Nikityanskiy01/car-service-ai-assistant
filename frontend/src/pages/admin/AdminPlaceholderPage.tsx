import { Link } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { resolveAdminBreadcrumbs, resolveAdminRouteTitle } from '../../config/adminRoutes';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Card } from '../../components/ui/Card';
import { usePageMeta } from '../../hooks/usePageMeta';

type Props = {
  path: string;
  phase?: string;
  description?: string;
};

export function AdminPlaceholderPage({ path, phase = 'скоро', description }: Props) {
  const title = resolveAdminRouteTitle(path);
  usePageMeta({ title, description: description || `Раздел «${title}» в разработке.` });

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title={title}
        description={description || 'Этот раздел появится в следующих фазах редизайна админки.'}
        breadcrumbs={resolveAdminBreadcrumbs(path)}
      />
      <Card className="admin-placeholder-card">
        <Construction size={32} aria-hidden className="admin-placeholder-icon" />
        <h2>В разработке</h2>
        <p className="muted-text">
          Раздел запланирован в спецификации <code>docs/admin-redesign-spec.md</code> ({phase}).
        </p>
        <Link to="/dashboard/admin" className="btn btn-secondary">
          Вернуться на пульт
        </Link>
      </Card>
    </div>
  );
}
