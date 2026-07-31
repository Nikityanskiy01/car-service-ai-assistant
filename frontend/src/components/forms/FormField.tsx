import { cloneElement, isValidElement, type ReactElement } from 'react';

type FieldControlProps = {
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
};

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const control =
    isValidElement(children)
      ? cloneElement(children as ReactElement<FieldControlProps>, {
          id: htmlFor,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': describedBy,
        })
      : children;

  return (
    <div className="form-field">
      <label className="form-field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {hint ? (
        <small id={hintId} className="field-hint">
          {hint}
        </small>
      ) : null}
      {control}
      {error ? (
        <small id={errorId} className="field-error" aria-live="polite">
          {error}
        </small>
      ) : null}
    </div>
  );
}
