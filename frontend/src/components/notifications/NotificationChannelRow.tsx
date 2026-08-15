import type { LucideIcon } from 'lucide-react';
import { ProfileSwitch } from '../profile/ProfileSwitch';

type Tone = 'inapp' | 'email' | 'telegram' | 'sms';

type Props = {
  id?: string;
  icon: LucideIcon;
  label: string;
  description: string;
  tone: Tone;
  checked?: boolean;
  onChange?: (value: boolean) => void;
  badge?: string;
  statusLabel?: string;
  statusVariant?: 'on' | 'off' | 'soon';
  disabled?: boolean;
  staticRow?: boolean;
};

export function NotificationChannelRow({
  id,
  icon: Icon,
  label,
  description,
  tone,
  checked,
  onChange,
  badge,
  statusLabel,
  statusVariant = 'on',
  disabled,
  staticRow,
}: Props) {
  if (staticRow) {
    return (
      <div className="notification-channel-row is-static" data-channel={tone}>
        <span className="notification-channel-icon" aria-hidden>
          <Icon size={17} strokeWidth={1.75} />
        </span>
        <div className="notification-channel-copy">
          <span className="notification-channel-label">{label}</span>
          <span className="notification-channel-desc">{description}</span>
        </div>
        <span className={`profile-access-badge is-${statusVariant}`}>{statusLabel || 'Включено'}</span>
      </div>
    );
  }

  return (
    <div className="notification-channel-row" data-channel={tone}>
      <span className="notification-channel-icon" aria-hidden>
        <Icon size={17} strokeWidth={1.75} />
      </span>
      <ProfileSwitch
        id={id || `channel-${tone}`}
        label={label}
        description={description}
        checked={Boolean(checked)}
        onChange={(v) => onChange?.(v)}
        disabled={disabled}
        badge={badge}
      />
    </div>
  );
}
