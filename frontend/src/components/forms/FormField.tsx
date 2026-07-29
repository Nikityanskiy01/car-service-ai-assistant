import { cloneElement, isValidElement, type ReactElement } from 'react';

type FieldControlProps = {
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
};

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
      {control}
      {error ? (
        <small id={describedBy} className="field-error" aria-live="polite">
          {error}
        </small>
      ) : null}
    </div>
  );
}
