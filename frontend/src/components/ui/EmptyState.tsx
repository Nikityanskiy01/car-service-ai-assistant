export function EmptyState({
  title = 'Пока пусто',
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="state-card">
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
