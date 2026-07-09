export function Alert({
  kind = 'info',
  children,
}: {
  kind?: 'info' | 'success' | 'warning' | 'error';
  children: React.ReactNode;
}) {
  return <div className={`alert alert-${kind}`}>{children}</div>;
}
