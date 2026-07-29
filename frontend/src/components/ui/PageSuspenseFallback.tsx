import { Skeleton } from './Skeleton';

export function PageSuspenseFallback() {
  return (
    <div className="page-suspense" role="status" aria-live="polite" aria-busy="true">
      <div className="page-suspense-inner">
        <Skeleton className="page-suspense-title" />
        <Skeleton className="page-suspense-line" />
        <Skeleton className="page-suspense-line page-suspense-line-short" />
        <div className="page-suspense-grid">
          <Skeleton className="page-suspense-card" />
          <Skeleton className="page-suspense-card" />
        </div>
      </div>
      <span className="page-suspense-label">Загрузка экрана…</span>
    </div>
  );
}
