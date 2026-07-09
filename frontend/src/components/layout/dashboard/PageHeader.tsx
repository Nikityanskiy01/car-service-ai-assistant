import type { ReactNode } from 'react';
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs';

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
}: {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      {breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="page-header-main">
        <div>
          <h1>{title}</h1>
          {description ? <p className="page-header-desc">{description}</p> : null}
        </div>
        {actions ? <div className="page-header-actions">{actions}</div> : null}
      </div>
    </header>
  );
}
