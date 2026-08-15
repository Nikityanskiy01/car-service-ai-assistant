import { Check, Copy, KeyRound, LockKeyhole, Mail, MessageCircle, Phone, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  confirmPhoneVerification,
  startPhoneVerification,
  startTelegramLink,
  unlinkTelegram,
  updateLoginMethods,
  type SecurityOverview,
  type TelegramLinkStart,
} from '../../api/dashboard';
import { copyText } from '../../lib/clipboard';
import { formatPhoneDisplay, maskEmail } from '../../lib/phone';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { FormField } from '../forms/FormField';
import { OtpCodeInput } from '../forms/OtpCodeInput';
import { SensitiveActionDialog } from './SensitiveActionDialog';

type Props = {
  overview: SecurityOverview;
  onReload: () => Promise<void>;
  onError: (message: string | null) => void;
  onSuccess: (message: string) => void;
};

type LoginMethodPatch = Parameters<typeof updateLoginMethods>[0];

type SensitiveAction =
  | {
      kind: 'login-method';
      patch: LoginMethodPatch;
      title: string;
      description: string;
      confirmLabel: string;
      success: string;
    }
  | {
      kind: 'unlink-telegram';
      title: string;
      description: string;
      confirmLabel: string;
      success: string;
    };

export function AccountAccessPanel({ overview, onReload, onError, onSuccess }: Props) {
  const [busy, setBusy] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneHint, setPhoneHint] = useState<string | null>(null);
  const [tgLink, setTgLink] = useState<TelegramLinkStart | null>(null);
  const [sensitiveAction, setSensitiveAction] = useState<SensitiveAction | null>(null);
  const [sensitiveError, setSensitiveError] = useState<string | null>(null);

  useEffect(() => {
    if (!tgLink?.code || overview.telegramLinked) return undefined;
    const id = window.setInterval(() => {
      void onReload();
    }, 2000);
    return () => window.clearInterval(id);
  }, [tgLink?.code, overview.telegramLinked, onReload]);

  useEffect(() => {
    if (overview.telegramLinked && tgLink) {
      setTgLink(null);
      onSuccess('Telegram подключён. Теперь можно входить с кодом из чата.');
    }
  }, [overview.telegramLinked, tgLink, onSuccess]);

  async function toggleMethod(patch: LoginMethodPatch, okText: string) {
    setBusy(true);
    onError(null);
    try {
      await updateLoginMethods(patch);
      onSuccess(okText);
      await onReload();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Не удалось обновить способ входа');
    } finally {
      setBusy(false);
    }
  }

  async function handleSensitiveAction(verification: { password: string; code?: string }) {
    if (!sensitiveAction) return;
    setBusy(true);
    setSensitiveError(null);
    onError(null);
    try {
      if (sensitiveAction.kind === 'unlink-telegram') {
        await unlinkTelegram(verification);
        setTgLink(null);
      } else {
        await updateLoginMethods({ ...sensitiveAction.patch, ...verification });
      }
      onSuccess(sensitiveAction.success);
      setSensitiveAction(null);
      await onReload();
    } catch (error) {
      setSensitiveError(error instanceof Error ? error.message : 'Не удалось подтвердить действие');
    } finally {
      setBusy(false);
    }
  }

  async function handleStartPhone() {
    setBusy(true);
    onError(null);
    try {
      const out = await startPhoneVerification();
      if (out.alreadyVerified) {
        onSuccess('Телефон уже подтверждён');
        setPhoneOpen(false);
        await onReload();
        return;
      }
      setPhoneHint(out.destinationHint || maskEmail(overview.email));
      setPhoneOpen(true);
      setPhoneCode('');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Не удалось отправить код');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmPhone(e: React.FormEvent) {
    e.preventDefault();
    if (phoneCode.length !== 6) return;
    setBusy(true);
    onError(null);
    try {
      await confirmPhoneVerification(phoneCode);
      setPhoneOpen(false);
      setPhoneCode('');
      onSuccess('Телефон подтверждён.');
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Неверный код');
    } finally {
      setBusy(false);
    }
  }

  async function handleStartTelegram() {
    setBusy(true);
    onError(null);
    try {
      const out = await startTelegramLink();
      if (out.alreadyLinked) {
        onSuccess('Telegram уже подключён');
        await onReload();
        return;
      }
      setTgLink(out);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Не удалось подключить Telegram');
    } finally {
      setBusy(false);
    }
  }

  const methods = overview.loginMethods;

  return (
    <Card className="profile-security-card">
      <header className="profile-section-head profile-section-head-inline">
        <span className="profile-section-icon" aria-hidden>
          <Shield size={18} />
        </span>
        <div>
          <h2>Способы входа</h2>
          <p>Выберите запасные способы входа. Отключение потребует пароль.</p>
        </div>
        <span className="profile-access-password-status">
          <LockKeyhole size={14} aria-hidden />
          Пароль включён
        </span>
      </header>

      <ul className="profile-access-list">
        <li className={`profile-access-row${methods.emailOtp ? ' is-active' : ''}`}>
          <span className="profile-access-icon" aria-hidden>
            <Mail size={16} />
          </span>
          <div className="profile-access-body">
            <div className="profile-access-title">
              <strong>Код на почту</strong>
              <StatusPill on={methods.emailOtp} />
            </div>
            <p>При входе отправим код на {maskEmail(overview.email)}. Подойдёт, если забыли пароль.</p>
          </div>
          <div className="profile-access-side">
            <Button
              type="button"
              variant={methods.emailOtp ? 'danger' : 'secondary'}
              disabled={busy || !overview.emailVerified}
              onClick={() => {
                if (!methods.emailOtp) {
                  void toggleMethod({ loginEmailOtpEnabled: true }, 'Вход по почте включён');
                  return;
                }
                setSensitiveError(null);
                setSensitiveAction({
                  kind: 'login-method',
                  patch: { loginEmailOtpEnabled: false },
                  title: 'Отключить вход по почте?',
                  description:
                    'Коды на почту перестанут работать. Если вы забудете пароль, восстановить доступ будет сложнее.',
                  confirmLabel: 'Отключить',
                  success: 'Вход по почте выключен',
                });
              }}
            >
              {methods.emailOtp ? 'Выключить' : 'Включить'}
            </Button>
          </div>
        </li>

        <li className={`profile-access-row${overview.phoneVerified && methods.sms ? ' is-active' : ''}`}>
          <span className="profile-access-icon" aria-hidden>
            <Phone size={16} />
          </span>
          <div className="profile-access-body">
            <div className="profile-access-title">
              <strong>SMS на телефон</strong>
              {overview.channels.smsConfigured ? (
                <StatusPill on={Boolean(overview.phoneVerified && methods.sms)} />
              ) : (
                <span className="profile-access-badge is-soon">Скоро</span>
              )}
            </div>
            <p>{smsAccessDescription(overview)}</p>

            {phoneOpen ? (
              <form className="profile-access-setup" onSubmit={(e) => void handleConfirmPhone(e)}>
                <p>
                  Код отправили на {phoneHint || maskEmail(overview.email)}. Введите его, чтобы подтвердить номер.
                </p>
                <FormField label="Код с почты" htmlFor="phone-verify-code">
                  <OtpCodeInput
                    id="phone-verify-code"
                    autoComplete="one-time-code"
                    value={phoneCode}
                    onChange={setPhoneCode}
                    disabled={busy}
                    required
                  />
                </FormField>
                <div className="profile-security-actions profile-2fa-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      setPhoneOpen(false);
                      setPhoneCode('');
                    }}
                  >
                    Отмена
                  </Button>
                  <Button type="submit" disabled={busy || phoneCode.length !== 6}>
                    {busy ? 'Проверка…' : 'Подтвердить телефон'}
                  </Button>
                </div>
              </form>
            ) : null}
          </div>
          <div className="profile-access-side">
            {!overview.phoneVerified ? (
              <Button type="button" onClick={() => void handleStartPhone()} disabled={busy}>
                {busy && phoneOpen ? 'Отправляем…' : 'Подтвердить через почту'}
              </Button>
            ) : (
              <Button
                type="button"
                variant={methods.sms ? 'danger' : 'secondary'}
                disabled={busy}
                onClick={() => {
                  if (!methods.sms) {
                    void toggleMethod({ loginSmsEnabled: true }, 'Вход по SMS включён');
                    return;
                  }
                  setSensitiveError(null);
                  setSensitiveAction({
                    kind: 'login-method',
                    patch: { loginSmsEnabled: false },
                    title: 'Отключить вход по SMS?',
                    description: 'Коды на подтверждённый номер больше не будут использоваться для входа.',
                    confirmLabel: 'Отключить',
                    success: 'Вход по SMS выключен',
                  });
                }}
              >
                {methods.sms ? 'Выключить' : 'Включить'}
              </Button>
            )}
          </div>
        </li>

        <li className={`profile-access-row${overview.telegramLinked && methods.telegram ? ' is-active' : ''}`}>
          <span className="profile-access-icon" aria-hidden>
            <MessageCircle size={16} />
          </span>
          <div className="profile-access-body">
            <div className="profile-access-title">
              <strong>Код в Telegram</strong>
              <StatusPill on={Boolean(overview.telegramLinked && methods.telegram)} />
            </div>
            <p>{telegramAccessDescription(overview)}</p>

            {tgLink?.code && !overview.telegramLinked ? (
              <div className="profile-access-setup">
                <div className="profile-2fa-step">
                  <span className="profile-2fa-step-num">1</span>
                  <span>Откройте бота и нажмите «Старт». Либо отправьте ему код ниже.</span>
                </div>
                <code className="profile-access-code">{formatLinkCode(tgLink.code)}</code>
                <div className="profile-security-actions profile-2fa-actions">
                  <CopyButton value={tgLink.code} label="Скопировать код" />
                  {tgLink.deepLink ? (
                    <Button type="button" onClick={() => window.open(tgLink.deepLink || '', '_blank', 'noopener')}>
                      Открыть Telegram
                    </Button>
                  ) : null}
                </div>
                <p className="profile-access-wait">
                  <KeyRound size={14} aria-hidden />
                  Ожидаем подтверждение от бота. Страница обновится автоматически.
                </p>
              </div>
            ) : null}
          </div>
          <div className="profile-access-side">
            {!overview.phoneVerified ? (
              <Button type="button" variant="secondary" disabled>
                Сначала подтвердите телефон
              </Button>
            ) : overview.telegramLinked ? (
              <>
                <Button
                  type="button"
                  variant={methods.telegram ? 'danger' : 'secondary'}
                  disabled={busy}
                  onClick={() => {
                    if (!methods.telegram) {
                      void toggleMethod({ loginTelegramEnabled: true }, 'Вход через Telegram включён');
                      return;
                    }
                    setSensitiveError(null);
                    setSensitiveAction({
                      kind: 'login-method',
                      patch: { loginTelegramEnabled: false },
                      title: 'Отключить вход через Telegram?',
                      description: 'Бот останется подключён, но перестанет присылать коды для входа.',
                      confirmLabel: 'Отключить вход',
                      success: 'Вход через Telegram выключен',
                    });
                  }}
                >
                  {methods.telegram ? 'Выключить вход' : 'Включить вход'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setSensitiveError(null);
                    setSensitiveAction({
                      kind: 'unlink-telegram',
                      title: 'Отвязать Telegram?',
                      description: 'Связь с ботом будет удалена. Для повторного подключения понадобится новый код.',
                      confirmLabel: 'Отвязать',
                      success: 'Telegram отключён',
                    });
                  }}
                >
                  Отключить Telegram
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={() => void handleStartTelegram()}
                disabled={busy || !overview.channels.telegramConfigured}
              >
                {overview.channels.telegramConfigured ? 'Подключить' : 'Пока недоступно'}
              </Button>
            )}
          </div>
        </li>
      </ul>

      <div className="profile-access-security-note">
        <LockKeyhole size={16} aria-hidden />
        <span>Опасные изменения подтверждаются паролем{overview.totpEnabled ? ' и кодом двухфакторной защиты' : ''}.</span>
      </div>

      <SensitiveActionDialog
        open={Boolean(sensitiveAction)}
        title={sensitiveAction?.title || 'Подтвердите действие'}
        description={sensitiveAction?.description || ''}
        confirmLabel={sensitiveAction?.confirmLabel || 'Подтвердить'}
        totpRequired={overview.totpEnabled}
        busy={busy}
        error={sensitiveError}
        onClose={() => {
          setSensitiveAction(null);
          setSensitiveError(null);
        }}
        onSubmit={(verification) => void handleSensitiveAction(verification)}
      />
    </Card>
  );
}

function StatusPill({ on }: { on: boolean }) {
  return <span className={`profile-access-badge ${on ? 'is-on' : 'is-off'}`}>{on ? 'Включено' : 'Выключено'}</span>;
}

function smsAccessDescription(overview: SecurityOverview) {
  const phone = formatPhoneDisplay(overview.phone) || 'Номер не указан';
  if (!overview.channels.smsConfigured) {
    return overview.phoneVerified
      ? `${phone}. Номер подтверждён. Вход по SMS появится позже.`
      : `${phone}. Номер ещё не подтверждён. Вход по SMS появится позже — номер можно подтвердить заранее.`;
  }
  return overview.phoneVerified ? `Код придёт на ${phone}.` : `${phone}. Номер ещё не подтверждён.`;
}

function telegramAccessDescription(overview: SecurityOverview) {
  if (!overview.phoneVerified) {
    return 'Сначала подтвердите телефон. Так бот будет связан именно с вашим номером.';
  }
  if (overview.telegramLinked) {
    return `Telegram подключён${overview.telegram ? ` · @${overview.telegram}` : ''}. При входе код придёт в чат.`;
  }
  return 'Подключите Telegram-бота. После этого можно входить с кодом из чата.';
}

function formatLinkCode(code: string) {
  return code.replace(/(.{4})/g, '$1 ').trim();
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
