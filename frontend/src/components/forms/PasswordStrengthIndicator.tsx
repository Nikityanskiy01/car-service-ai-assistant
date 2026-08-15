import { Check, Circle } from 'lucide-react';
import { analyzePasswordStrength } from '../../lib/validation';

export function PasswordStrengthIndicator({
  password,
  id,
  alwaysVisible = false,
}: {
  password: string;
  id?: string;
  alwaysVisible?: boolean;
}) {
  const strength = analyzePasswordStrength(password);
  if (!password && !alwaysVisible) return null;

  const labelId = id ? `${id}-strength-label` : undefined;
  const empty = !password;

  return (
    <div className="password-strength" role="group" aria-labelledby={labelId}>
      <div className="password-strength-head">
        <span id={labelId} className="password-strength-title">Надёжность пароля</span>
        <span className={`password-strength-badge ${empty ? 'is-empty' : `is-level-${strength.level}`}`}>
          {empty ? 'Не задан' : strength.label}
        </span>
      </div>

      <div
        className="password-strength-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={empty ? 0 : strength.level}
        aria-label={`Надёжность пароля: ${empty ? 'не задан' : strength.label}`}
      >
        {Array.from({ length: 4 }, (_, index) => (
          <span
            key={index}
            className={`password-strength-segment${index < strength.level ? ' is-active' : ''} is-level-${strength.level}`}
          />
        ))}
      </div>

      <ul className="password-strength-checks" aria-label="Требования к паролю">
        {strength.checks.map((check) => (
          <li key={check.id} className={check.met ? 'is-met' : ''}>
            <span className="password-strength-check-icon" aria-hidden>
              {check.met ? <Check size={12} strokeWidth={3} /> : <Circle size={12} strokeWidth={2} />}
            </span>
            <span>{check.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
