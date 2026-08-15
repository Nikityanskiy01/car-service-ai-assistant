import { Link } from 'react-router-dom';

type Props = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string | null;
  required?: boolean;
};

/**
 * Согласие на обработку ПДн (ст. 9 Федерального закона № 152-ФЗ).
 * Отправка формы возможна только при отмеченном чекбоксе.
 */
export function ConsentCheckbox({ id, checked, onChange, error = null, required = true }: Props) {
  return (
    <div className={`consent-field${error ? ' is-invalid' : ''}`}>
      <label className="consent-label" htmlFor={id} data-required={required || undefined}>
        <input
          id={id}
          className="consent-checkbox"
          type="checkbox"
          checked={checked}
          required={required}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <span className="consent-text">
          Отправляя форму, я даю согласие на обработку персональных данных в соответствии с{' '}
          <Link to="/privacy" target="_blank" rel="noopener noreferrer">
            Политикой обработки персональных данных
          </Link>{' '}
          и принимаю условия{' '}
          <Link to="/terms" target="_blank" rel="noopener noreferrer">
            Пользовательского соглашения
          </Link>
          .
        </span>
      </label>
      {error ? (
        <small id={`${id}-error`} className="field-error" aria-live="polite">
          {error}
        </small>
      ) : null}
    </div>
  );
}
