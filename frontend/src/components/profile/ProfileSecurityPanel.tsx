import { Check, Copy, Download, KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  abortTotpSetup,
  confirmTotpSetup,
  disableTotp,
  getSecurityOverview,
  regenerateBackupCodes,
  startTotpSetup,
  type LoginHistoryItem,
  type ActiveSessionItem,
  type SecurityOverview,
  type TotpSetupPayload,
} from '../../api/dashboard';
import { copyText } from '../../lib/clipboard';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { FormField } from '../forms/FormField';
import { OtpCodeInput } from '../forms/OtpCodeInput';
import { Input } from '../ui/Input';
import { Loader } from '../ui/Loader';
import { PasswordInput } from '../forms/PasswordInput';
import { ActiveSessionsPanel } from './ActiveSessionsPanel';
import { DisableTotpDialog } from './DisableTotpDialog';
import { LoginHistoryPanel } from './LoginHistoryPanel';
import { AccountAccessPanel } from './AccountAccessPanel';
import { PrivacyDataPanel } from './PrivacyDataPanel';
import { useAuth } from '../../auth/AuthProvider';
import type { SecuritySection } from '../../lib/profileSecurityTabs';

type ManageAction = 'backup' | 'disable' | null;

type Props = {
  section: Exclude<SecuritySection, 'password'>;
};

export function ProfileSecurityPanel({ section }: Props) {
  const { refreshCurrentUser, setUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpEnabledAt, setTotpEnabledAt] = useState<string | null>(null);
  const [backupRemaining, setBackupRemaining] = useState(0);
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [history, setHistory] = useState<LoginHistoryItem[]>([]);
  const [sessions, setSessions] = useState<ActiveSessionItem[]>([]);

  const [setup, setSetup] = useState<TotpSetupPayload | null>(null);
  const [setupCode, setSetupCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const [manageAction, setManageAction] = useState<ManageAction>(null);
  const [verifyPassword, setVerifyPassword] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyUseBackup, setVerifyUseBackup] = useState(false);
  const [abortSetupOpen, setAbortSetupOpen] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const data = await getSecurityOverview();
      setOverview(data);
      setTotpEnabled(data.totpEnabled);
      setTotpEnabledAt(data.totpEnabledAt);
      setBackupRemaining(data.backupRemaining ?? 0);
      setHistory(data.history);
      setSessions(data.sessions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить настройки безопасности');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(null), 4500);
    return () => window.clearTimeout(t);
  }, [success]);

  function resetVerify() {
    setVerifyPassword('');
    setVerifyCode('');
    setVerifyUseBackup(false);
  }

  async function handleStartSetup() {
    setBusy(true);
    setError(null);
    setBackupCodes(null);
    try {
      const data = await startTotpSetup();
      setSetup(data);
      setSetupCode('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось начать настройку');
    } finally {
      setBusy(false);
    }
  }

  async function handleAbortSetup() {
    setAbortSetupOpen(false);
    setBusy(true);
    setError(null);
    try {
      await abortTotpSetup();
      setSetup(null);
      setSetupCode('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отменить настройку');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmSetup(e: React.FormEvent) {
    e.preventDefault();
    if (setupCode.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const out = await confirmTotpSetup(setupCode.trim());
      setBackupCodes(out.backupCodes);
      setSetup(null);
      setSetupCode('');
      setSuccess('Дополнительная защита включена');
      if (out.user) setUser({ ...out.user, totpSetupPending: false });
      await refreshCurrentUser();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось подтвердить код');
    } finally {
      setBusy(false);
    }
  }

  async function handleManageSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manageAction !== 'backup') return;
    setBusy(true);
    setError(null);
    try {
      const out = await regenerateBackupCodes({ password: verifyPassword, code: verifyCode.trim() });
      setBackupCodes(out.backupCodes);
      setSuccess('Новые резервные коды созданы. Старые больше не действуют.');
      resetVerify();
      setManageAction(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить действие');
    } finally {
      setBusy(false);
    }
  }

  async function handleDisableTotp(body: { password: string; code: string; confirmPhrase: string }) {
    setBusy(true);
    setError(null);
    try {
      await disableTotp(body);
      setBackupCodes(null);
      setSuccess('Дополнительная защита отключена. Теперь вход только по паролю.');
      setManageAction(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отключить защиту');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loader label="Загрузка настроек безопасности…" />;

  const showAlerts = section === 'access' || section === 'protection' || section === 'sessions';

  return (
    <div className="profile-security-stack">
      {showAlerts && error && manageAction !== 'disable' ? <Alert kind="error">{error}</Alert> : null}
      {showAlerts && success ? <Alert kind="success">{success}</Alert> : null}

      {section === 'access' && overview ? (
        <AccountAccessPanel
          overview={overview}
          onReload={reload}
          onError={setError}
          onSuccess={setSuccess}
        />
      ) : null}

      {section === 'protection' ? (
      <Card className="profile-security-card">
        <header className="profile-section-head profile-section-head-inline">
          <span className="profile-section-icon" aria-hidden>
            {totpEnabled ? <ShieldCheck size={18} /> : <KeyRound size={18} />}
          </span>
          <div>
            <h2>Защита входа</h2>
            <p>
              {totpEnabled
                ? `Включена${totpEnabledAt ? ` с ${formatDate(totpEnabledAt)}` : ''}. Осталось ${formatBackupRemaining(backupRemaining)}.`
                : 'При каждом входе понадобится код из приложения на телефоне'}
            </p>
          </div>
          {totpEnabled && !setup ? (
            <span className="profile-2fa-status">Включена</span>
          ) : null}
        </header>

        {!totpEnabled && !setup && !backupCodes ? (
          <div className="profile-2fa-idle">
            <p>
              Добавьте приложение для кодов — например Google Authenticator. Даже если кто-то узнает пароль, без кода войти не получится.
            </p>
            <div className="profile-security-actions">
              <Button type="button" onClick={() => void handleStartSetup()} disabled={busy}>
                {busy ? 'Подготовка…' : 'Включить защиту'}
              </Button>
            </div>
          </div>
        ) : null}

        {setup ? (
          <form
            className="profile-2fa-setup"
            onSubmit={(e) => void handleConfirmSetup(e)}
          >
            <div className="profile-2fa-step">
              <span className="profile-2fa-step-num">1</span>
              <span>Отсканируйте QR-код в приложении для кодов</span>
            </div>

            <div className="profile-2fa-pair">
              <div className="profile-2fa-qr-shell">
                <div className="profile-2fa-qr-core">
                  <img src={setup.qrDataUrl} alt="QR-код для настройки защиты входа" className="profile-2fa-qr" />
                </div>
              </div>

              <div className="profile-2fa-manual">
                <p>Если не получается отсканировать, введите ключ вручную</p>
                <code className="profile-2fa-secret">{formatSecret(setup.secret)}</code>
                <CopyButton value={setup.secret} label="Скопировать ключ" />
              </div>
            </div>

            <div className="profile-2fa-verify">
              <div className="profile-2fa-step">
                <span className="profile-2fa-step-num">2</span>
                <span>Введите код из приложения, чтобы завершить настройку</span>
              </div>
              <FormField label="Код из приложения" htmlFor="totp-setup-code">
                <OtpCodeInput
                  id="totp-setup-code"
                  autoComplete="one-time-code"
                  value={setupCode}
                  onChange={(next) => {
                    setSetupCode(next);
                    if (error) setError(null);
                  }}
                  disabled={busy}
                  required
                  aria-invalid={Boolean(error)}
                />
              </FormField>
            </div>

            {setup.backupCodes?.length ? (
              <div className="profile-2fa-backup-inline">
                <div className="profile-2fa-step">
                  <span className="profile-2fa-step-num">3</span>
                  <span>Сохраните резервные коды. Если не будет доступа к приложению, каждым кодом можно войти один раз.</span>
                </div>
                <BackupCodesBlock codes={setup.backupCodes} />
              </div>
            ) : null}

            <div className="profile-security-actions profile-2fa-actions">
              <Button type="button" variant="secondary" onClick={() => setAbortSetupOpen(true)} disabled={busy}>
                Отмена
              </Button>
              <Button type="submit" disabled={busy || setupCode.length !== 6}>
                {busy ? 'Проверка…' : 'Подтвердить'}
              </Button>
            </div>
          </form>
        ) : null}

        {backupCodes && !setup ? (
          <div className="profile-2fa-backup">
            <div className="profile-2fa-backup-head">
              <strong>Сохраните резервные коды</strong>
              <p>Покажем их только сейчас. Каждый код действует один раз, если не будет доступа к приложению.</p>
            </div>
            <BackupCodesBlock codes={backupCodes} />
            <div className="profile-security-actions profile-2fa-actions">
              <Button type="button" onClick={() => setBackupCodes(null)}>
                Готово
              </Button>
            </div>
          </div>
        ) : null}

        {totpEnabled && !setup && !backupCodes ? (
          <div className="profile-2fa-manage">
            <div className="profile-security-actions profile-2fa-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  resetVerify();
                  setManageAction(manageAction === 'backup' ? null : 'backup');
                }}
                disabled={busy}
              >
                Получить новые резервные коды
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  resetVerify();
                  setManageAction(manageAction === 'disable' ? null : 'disable');
                }}
                disabled={busy}
              >
                <Trash2 size={16} aria-hidden />
                Отключить защиту
              </Button>
            </div>

            {manageAction === 'backup' ? (
              <form className="profile-2fa-disable" onSubmit={(e) => void handleManageSubmit(e)}>
                <p>Текущие резервные коды перестанут действовать. Чтобы получить новые, подтвердите пароль и код.</p>
                <FormField label="Пароль" htmlFor="totp-verify-password">
                  <PasswordInput
                    id="totp-verify-password"
                    value={verifyPassword}
                    onChange={(e) => setVerifyPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </FormField>
                {verifyUseBackup ? (
                  <FormField label="Резервный код" htmlFor="totp-verify-code">
                    <Input
                      id="totp-verify-code"
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value)}
                      placeholder="XXXX-XXXX"
                      autoComplete="off"
                      required
                    />
                  </FormField>
                ) : (
                  <FormField label="Код из приложения" htmlFor="totp-verify-code">
                    <OtpCodeInput
                      id="totp-verify-code"
                      value={verifyCode}
                      onChange={setVerifyCode}
                      disabled={busy}
                      required
                    />
                  </FormField>
                )}
                <button
                  type="button"
                  className="profile-2fa-switch"
                  onClick={() => {
                    setVerifyUseBackup((v) => !v);
                    setVerifyCode('');
                  }}
                >
                  {verifyUseBackup ? 'Ввести код из приложения' : 'Ввести резервный код'}
                </button>
                <div className="profile-security-actions profile-2fa-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setManageAction(null);
                      resetVerify();
                    }}
                    disabled={busy}
                  >
                    Отмена
                  </Button>
                  <Button type="submit" disabled={busy}>
                    {busy ? 'Проверка…' : 'Получить новые'}
                  </Button>
                </div>
              </form>
            ) : null}
          </div>
        ) : null}
      </Card>
      ) : null}

      {section === 'sessions' ? (
        <Card className="profile-security-card">
          <ActiveSessionsPanel
            sessions={sessions}
            onReload={reload}
            onError={setError}
            onSuccess={setSuccess}
          />
        </Card>
      ) : null}

      {section === 'history' ? (
        <Card className="profile-security-card">
          <LoginHistoryPanel history={history} />
        </Card>
      ) : null}

      {section === 'privacy' ? <PrivacyDataPanel totpRequired={Boolean(overview?.totpEnabled)} /> : null}

      <ConfirmDialog
        open={abortSetupOpen}
        title="Отменить настройку?"
        text="Ключ с этой страницы перестанет действовать. Если вы уже отсканировали QR-код, удалите запись в приложении для кодов."
        confirmLabel="Отменить настройку"
        onCancel={() => setAbortSetupOpen(false)}
        onConfirm={() => void handleAbortSetup()}
      />
      <DisableTotpDialog
        open={manageAction === 'disable'}
        busy={busy}
        error={manageAction === 'disable' ? error : null}
        onClose={() => {
          setManageAction(null);
          setError(null);
        }}
        onSubmit={(body) => void handleDisableTotp(body)}
      />
    </div>
  );
}

function BackupCodesBlock({ codes }: { codes: string[] }) {
  return (
    <div className="profile-2fa-backup-block">
      <ul>
        {codes.map((code) => (
          <li key={code}>
            <code>{code}</code>
          </li>
        ))}
      </ul>
      <div className="profile-security-actions profile-2fa-actions">
        <CopyButton value={codes.join('\n')} label="Скопировать все коды" />
        <Button type="button" variant="secondary" onClick={() => downloadBackupCodes(codes)}>
          <Download size={16} aria-hidden />
          Скачать коды
        </Button>
      </div>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
      className="profile-2fa-copy"
      onClick={() => {
        void copyText(value).then((ok) => {
          if (!ok) return;
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
    >
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      {copied ? 'Скопировано' : label}
    </Button>
  );
}

function formatSecret(secret: string) {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

function downloadBackupCodes(codes: string[]) {
  const blob = new Blob([`${codes.join('\n')}\n`], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = '2fa-backup-codes.txt';
  link.click();
  URL.revokeObjectURL(url);
}

function formatBackupRemaining(count: number) {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  const noun =
    abs > 10 && abs < 20
      ? 'резервных кодов'
      : last === 1
        ? 'резервный код'
        : last > 1 && last < 5
          ? 'резервных кода'
          : 'резервных кодов';
  return `${count} ${noun}`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('ru-RU');
  } catch {
    return iso;
  }
}
