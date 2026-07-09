export function FormField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  const describedBy = error ? `${htmlFor}-error` : undefined;
  return (
    <label className="form-field" htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
      {error ? (
        <small id={describedBy} className="field-error" aria-live="polite">
          {error}
        </small>
      ) : null}
    </label>
  );
}
