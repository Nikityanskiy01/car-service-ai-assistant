type Props = {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  badge?: string;
};

export function ProfileSwitch({ id, label, description, checked, onChange, disabled, badge }: Props) {
  return (
    <label className={`profile-switch${disabled ? ' is-disabled' : ''}`} htmlFor={id}>
      <span className="profile-switch-copy">
        <span className="profile-switch-label-row">
          <span className="profile-switch-label">{label}</span>
          {badge ? <span className="profile-access-badge is-soon">{badge}</span> : null}
        </span>
        {description ? <span className="profile-switch-desc">{description}</span> : null}
      </span>
      <span className="profile-switch-track" aria-hidden>
        <input
          id={id}
          type="checkbox"
          className="profile-switch-input"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="profile-switch-thumb" />
      </span>
    </label>
  );
}
