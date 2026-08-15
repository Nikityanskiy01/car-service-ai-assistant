import { AlertTriangle, CheckCircle2, Globe, History, Laptop, Monitor, Smartphone, Tablet } from 'lucide-react';
import type { LoginHistoryItem } from '../../api/dashboard';
import {
  deviceTitle,
  formatRelativeTime,
  formatShortDateTime,
  ipDescription,
  loginMethodLabel,
} from '../../lib/clientMeta';

type Props = {
  history: LoginHistoryItem[];
};

export function LoginHistoryPanel({ history }: Props) {
  return (
    <>
      <header className="profile-section-head profile-section-head-inline">
        <span className="profile-section-icon" aria-hidden>
          <History size={18} />
        </span>
        <div>
          <h2>История входов</h2>
          <p>Последние попытки входа с указанием способа, устройства и адреса</p>
        </div>
      </header>

      {history.length === 0 ? (
        <p className="muted">Пока нет записей. Они появятся после следующего входа.</p>
      ) : (
        <ul className="profile-login-history">
          {history.map((item) => (
            <li key={item.id} className={item.success ? 'is-ok' : 'is-fail'}>
              <span className="profile-login-history-icon" aria-hidden>
                {item.success ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertTriangle size={16} />
                )}
              </span>

              <div className="profile-login-history-body">
                <div className="profile-login-history-head">
                  <strong>{item.success ? 'Успешный вход' : 'Неудачная попытка'}</strong>
                  <span className="profile-login-history-method">
                    {item.methodLabel || loginMethodLabel(item.method)}
                  </span>
                </div>

                <div className="profile-login-history-meta">
                  <span className="profile-login-history-device">
                    <DeviceIcon deviceType={item.device?.deviceType} />
                    {deviceTitle(item.device)}
                  </span>
                  <span>
                    <Globe size={12} aria-hidden />
                    {ipDescription(item.ipLabel, item.ipKind)}
                  </span>
                  {!item.success && item.reasonLabel ? (
                    <span className="profile-login-history-reason">{item.reasonLabel}</span>
                  ) : null}
                </div>
              </div>

              <div className="profile-login-history-time">
                <time dateTime={item.createdAt} title={formatShortDateTime(item.createdAt)}>
                  {formatRelativeTime(item.createdAt)}
                </time>
                <span>{formatShortDateTime(item.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function DeviceIcon({ deviceType }: { deviceType?: string }) {
  if (deviceType === 'mobile') return <Smartphone size={12} />;
  if (deviceType === 'tablet') return <Tablet size={12} />;
  if (deviceType === 'desktop') return <Laptop size={12} />;
  return <Monitor size={12} />;
}
