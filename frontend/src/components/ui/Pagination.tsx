import { Button } from './Button';

export function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="row gap-sm">
      <Button variant="ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Назад
      </Button>
      <span>
        {page} / {pages}
      </span>
      <Button variant="ghost" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Вперёд
      </Button>
    </div>
  );
}
