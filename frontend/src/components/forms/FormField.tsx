import { Children, cloneElement, isValidElement, type ReactElement } from 'react';

type FieldControlProps = {
  id?: string;
  required?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
};

function firstFieldControl(children: React.ReactNode): ReactElement<FieldControlProps> | null {
  const found = Children.toArray(children).find((child) => isValidElement(child));
  return found && isValidElement(found) ? (found as ReactElement<FieldControlProps>) : null;
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
}) {
  const controlElement = firstFieldControl(children);
  const isRequired = required ?? Boolean(controlElement?.props.required);
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  let cloned = false;
  const control = Children.map(children, (child) => {
    if (!isValidElement(child) || cloned) return child;
    cloned = true;
    return cloneElement(child as ReactElement<FieldControlProps>, {
      id: htmlFor,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': describedBy,
    });
  });

  return (
    <div className="form-field">
      <label className="form-field-label" htmlFor={htmlFor}>
        <span className="form-field-label-text" data-required={isRequired || undefined}>
          {label}
        </span>
        {hint ? (
          <small id={hintId} className="field-hint">
            {hint}
          </small>
        ) : null}
      </label>
      {control}
      {error ? (
        <small id={errorId} className="field-error" aria-live="polite">
          {error}
        </small>
      ) : null}
    </div>
  );
}
