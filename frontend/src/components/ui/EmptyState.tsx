export function EmptyState({
  title = 'Пока пусто',
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="state-card">
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div className="state-card-action">{action}</div> : null}
    </div>
  );
}
