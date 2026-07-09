export function Loader({ label = 'Загрузка...' }: { label?: string }) {
  return (
    <div className="loader-wrap" role="status" aria-live="polite">
      <div className="loader" />
      <span>{label}</span>
    </div>
  );
}
