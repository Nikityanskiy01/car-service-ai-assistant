import { Globe, Laptop, LogOut, Monitor, Smartphone, Tablet } from 'lucide-react';
import { useState } from 'react';
import {
  revokeOtherSessions,
  revokeSession,
  type ActiveSessionItem,
} from '../../api/dashboard';
import { useAuth } from '../../auth/AuthProvider';
import {
  deviceTitle,
  formatRelativeTime,
  formatSessionExpiry,
  formatShortDateTime,
  ipDescription,
} from '../../lib/clientMeta';
import { Button } from '../ui/Button';
import { SessionRevokeDialog } from './SessionRevokeDialog';

type Props = {
  sessions: ActiveSessionItem[];
  onReload: () => Promise<void>;
  onError: (message: string | null) => void;
  onSuccess: (message: string) => void;
};

type RevokeTarget =
  | { scope: 'one'; session: ActiveSessionItem }
  | { scope: 'others'; sessions: ActiveSessionItem[] };

export function ActiveSessionsPanel({ sessions, onReload, onError, onSuccess }: Props) {
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<RevokeTarget | null>(null);

  const otherSessions = sessions.filter((item) => !item.current);

  async function handleConfirmed(code: string) {
    if (!revokeTarget) return;
    setBusy(true);
    onError(null);
    try {
      if (revokeTarget.scope === 'one') {
        const out = await revokeSession(revokeTarget.session.id, code);
        setRevokeTarget(null);
        if (out.currentRevoked) {
          onSuccess('Текущая сессия завершена');
          await logout();
          return;
        }
        onSuccess('Сессия завершена');
      } else {
        const out = await revokeOtherSessions(code);
        setRevokeTarget(null);
        onSuccess(
          out.revoked > 0
            ? `Завершено других сессий: ${out.revoked}`
            : 'Других активных сессий не было',
        );
      }
      await onReload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="profile-section-head profile-section-head-inline">
        <span className="profile-section-icon" aria-hidden>
          <Monitor size={18} />
        </span>
        <div>
          <h2>Активные сессии</h2>
          <p>
            Устройства, где вы сейчас авторизованы. Завершение подтверждается кодом с почты — так
            чужой доступ не отключит ваши устройства.
          </p>
        </div>
        {otherSessions.length > 0 ? (
          <Button
            type="button"
            variant="secondary"
            className="profile-sessions-revoke-all"
            disabled={busy}
            onClick={() => setRevokeTarget({ scope: 'others', sessions: otherSessions })}
          >
            <LogOut size={14} aria-hidden />
            Завершить другие ({otherSessions.length})
          </Button>
        ) : null}
      </header>

      {sessions.length === 0 ? (
        <p className="muted">Активных сессий нет. Они появятся после следующего входа.</p>
      ) : (
        <ul className="profile-sessions-list">
          {sessions.map((session) => (
            <li
              key={session.id}
              className={`profile-session-row${session.current ? ' is-current' : ''}`}
            >
              <span className="profile-session-icon" aria-hidden>
                <DeviceIcon deviceType={session.device?.deviceType} />
              </span>

              <div className="profile-session-body">
                <div className="profile-session-title">
                  <strong>{deviceTitle(session.device)}</strong>
                  {session.current ? <span className="profile-session-badge">Это устройство</span> : null}
                </div>

                <div className="profile-session-meta">
                  <span>
                    <Globe size={12} aria-hidden />
                    {ipDescription(session.ipLabel, session.ipKind)}
                  </span>
                  <span>
                    Активность {formatRelativeTime(session.lastUsedAt)} · вход{' '}
                    {formatShortDateTime(session.createdAt)}
                  </span>
                  <span>Сессия {formatSessionExpiry(session.expiresAt)}</span>
                </div>
              </div>

              <div className="profile-session-side">
                {!session.current ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setRevokeTarget({ scope: 'one', session })}
                  >
                    Завершить
                  </Button>
                ) : (
                  <span className="profile-session-current-note">Текущая</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <SessionRevokeDialog
        open={Boolean(revokeTarget)}
        scope={revokeTarget?.scope ?? 'others'}
        sessionId={revokeTarget?.scope === 'one' ? revokeTarget.session.id : undefined}
        title={revokeTarget?.scope === 'one' ? 'Завершить сессию?' : 'Завершить все другие сессии?'}
        description={
          revokeTarget?.scope === 'one'
            ? 'На этом устройстве потребуется войти снова. Подтвердите действие кодом из письма.'
            : 'На остальных устройствах потребуется повторный вход. Текущая сессия останется активной.'
        }
        confirmLabel={revokeTarget?.scope === 'one' ? 'Завершить сессию' : 'Завершить другие'}
        target={revokeTarget ? <RevokeTargetSummary target={revokeTarget} /> : null}
        onClose={() => setRevokeTarget(null)}
        onConfirmed={handleConfirmed}
      />
    </>
  );
}

function RevokeTargetSummary({ target }: { target: RevokeTarget }) {
  const items = target.scope === 'one' ? [target.session] : target.sessions;
  const visible = items.slice(0, 3);
  const hidden = items.length - visible.length;

  return (
    <ul className="session-revoke-devices">
      {visible.map((session) => (
        <li key={session.id}>
          <span className="session-revoke-device-icon" aria-hidden>
            <DeviceIcon deviceType={session.device?.deviceType} />
          </span>
          <div>
            <strong>{deviceTitle(session.device)}</strong>
            <span>
              {ipDescription(session.ipLabel, session.ipKind)} · активность{' '}
              {formatRelativeTime(session.lastUsedAt)}
            </span>
          </div>
        </li>
      ))}
      {hidden > 0 ? (
        <li className="session-revoke-devices-more">и ещё {hidden}</li>
      ) : null}
    </ul>
  );
}

function DeviceIcon({ deviceType }: { deviceType?: string }) {
  if (deviceType === 'mobile') return <Smartphone size={16} />;
  if (deviceType === 'tablet') return <Tablet size={16} />;
  if (deviceType === 'desktop') return <Laptop size={16} />;
  return <Monitor size={16} />;
}
