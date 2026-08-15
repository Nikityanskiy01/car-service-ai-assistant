import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteMyAccount, exportMyData } from '../../api/dashboard';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { SensitiveActionDialog } from './SensitiveActionDialog';

export function PrivacyDataPanel({ totpRequired }: { totpRequired: boolean }) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isClient = user?.role === 'CLIENT';

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'my-data.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось выгрузить данные');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(body: { password: string; code?: string }) {
    setBusy(true);
    setError(null);
    try {
      await deleteMyAccount(body);
      setDeleteOpen(false);
      await logout();
      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить аккаунт');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="profile-security-card">
      <header className="profile-section-head profile-section-head-inline">
        <span className="profile-section-icon" aria-hidden>
          <Download size={18} />
        </span>
        <div>
          <h2>Персональные данные</h2>
          <p>Выгрузка копии данных и удаление аккаунта по 152-ФЗ</p>
        </div>
      </header>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="profile-security-actions">
        <Button type="button" variant="secondary" onClick={() => void handleExport()} disabled={busy}>
          <Download size={16} aria-hidden />
          {busy ? 'Подготовка…' : 'Скачать мои данные'}
        </Button>
        {isClient ? (
          <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)} disabled={busy}>
            <Trash2 size={16} aria-hidden />
            Удалить аккаунт
          </Button>
        ) : (
          <p className="profile-save-hint">Удаление учётной записи сотрудника выполняет администратор.</p>
        )}
      </div>

      <SensitiveActionDialog
        open={deleteOpen}
        title="Удалить аккаунт?"
        description="Имя, телефон, почта и вход будут обезличены. Заявки и записи в сервисе сохранятся без ваших контактов. Это нельзя отменить."
        confirmLabel="Удалить навсегда"
        totpRequired={totpRequired}
        busy={busy}
        error={error}
        onClose={() => {
          setDeleteOpen(false);
          setError(null);
        }}
        onSubmit={(body) => void handleDelete(body)}
      />
    </Card>
  );
}
