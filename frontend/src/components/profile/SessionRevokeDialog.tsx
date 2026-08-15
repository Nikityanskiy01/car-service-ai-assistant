import { Loader2, MailCheck, MailWarning, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  startSessionRevoke,
  type SessionRevokeChallenge,
  type SessionRevokeScope,
} from '../../api/dashboard';
import { FormField } from '../forms/FormField';
import { OtpCodeInput } from '../forms/OtpCodeInput';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

const CODE_FIELD_ID = 'session-revoke-code';

type Props = {
  open: boolean;
  scope: SessionRevokeScope;
  sessionId?: string;
  title: string;
  description: string;
  confirmLabel: string;
  target?: React.ReactNode;
  onClose: () => void;
  onConfirmed: (code: string) => Promise<void>;
};

export function SessionRevokeDialog({
  open,
  scope,
  sessionId,
  title,
  description,
  confirmLabel,
  target,
  onClose,
  onConfirmed,
}: Props) {
  const [challenge, setChallenge] = useState<SessionRevokeChallenge | null>(null);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const requestKey = open ? `${scope}:${sessionId ?? ''}` : null;
  const startedKey = useRef<string | null>(null);

  const requestCode = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      const out = await startSessionRevoke({ scope, sessionId });
      setChallenge(out);
      setCooldown(out.resendAfterSec || 60);
      window.setTimeout(() => document.getElementById(CODE_FIELD_ID)?.focus(), 0);
    } catch (e) {
      setChallenge(null);
      setError(e instanceof Error ? e.message : 'Не удалось отправить код');
    } finally {
      setSending(false);
    }
  }, [scope, sessionId]);

  useEffect(() => {
    if (!requestKey) {
      startedKey.current = null;
      setChallenge(null);
      setCode('');
      setError(null);
      setCooldown(0);
      return;
    }
    // Ref-гвард, а не только зависимость эффекта: в StrictMode второй прогон
    // упёрся бы в серверный cooldown и показал ошибку на пустом месте.
    if (startedKey.current === requestKey) return;
    startedKey.current = requestKey;
    setChallenge(null);
    setCode('');
    void requestCode();
  }, [requestKey, requestCode]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  function close() {
    if (busy) return;
    onClose();
  }

  async function submit(nextCode?: string) {
    const value = (nextCode ?? code).trim();
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirmed(value);
    } catch (e) {
      setCode('');
      setError(e instanceof Error ? e.message : 'Не удалось подтвердить действие');
      document.getElementById(CODE_FIELD_ID)?.focus();
    } finally {
      setBusy(false);
    }
  }

  const ttlMinutes = challenge ? Math.max(1, Math.round(challenge.expiresInSec / 60)) : 0;
  const codeReady = Boolean(challenge) && !sending;

  return (
    <Modal open={open} title={title} onClose={close} className="modal-session-revoke">
      <form
        className="session-revoke"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="session-revoke-intro">
          <span aria-hidden>
            <ShieldAlert size={20} />
          </span>
          <p>{description}</p>
        </div>

        {target}

        <FormField label="Код из письма" htmlFor={CODE_FIELD_ID} error={error} required>
          <OtpCodeInput
            id={CODE_FIELD_ID}
            value={code}
            onChange={setCode}
            onComplete={(next) => void submit(next)}
            disabled={!codeReady || busy}
          />
        </FormField>

        <div className="session-revoke-meta">
          <p className="session-revoke-status" role="status">
            {sending ? (
              <>
                <Loader2 size={14} className="spin" aria-hidden />
                Отправляем код на почту…
              </>
            ) : challenge ? (
              <>
                <MailCheck size={14} aria-hidden />
                Код отправлен на {challenge.destinationHint} · действует {ttlMinutes} мин.
              </>
            ) : (
              <>
                <MailWarning size={14} aria-hidden />
                Код не отправлен. Попробуйте запросить ещё раз.
              </>
            )}
          </p>

          <button
            type="button"
            className="session-revoke-resend"
            disabled={sending || busy || cooldown > 0}
            onClick={() => void requestCode()}
          >
            {cooldown > 0 ? `Отправить повторно (${cooldown} с)` : 'Отправить повторно'}
          </button>
        </div>

        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={close} disabled={busy}>
            Отмена
          </Button>
          <Button type="submit" variant="danger" disabled={busy || !codeReady || code.length !== 6}>
            {busy ? 'Проверяем…' : confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
