type Props = {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function ProfileSwitch({ id, label, description, checked, onChange }: Props) {
  return (
    <label className="profile-switch" htmlFor={id}>
      <span className="profile-switch-copy">
        <span className="profile-switch-label">{label}</span>
        {description ? <span className="profile-switch-desc">{description}</span> : null}
      </span>
      <span className="profile-switch-track" aria-hidden>
        <input
          id={id}
          type="checkbox"
          className="profile-switch-input"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="profile-switch-thumb" />
      </span>
    </label>
  );
}
