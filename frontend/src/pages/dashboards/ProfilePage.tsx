import { Link, useSearchParams } from 'react-router-dom';
import { Car, User } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { api } from '../../api/client';
import { patchProfile } from '../../api/dashboard';
import { DashboardWelcomeHero } from '../../components/dashboard/DashboardWelcomeHero';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { FormField } from '../../components/forms/FormField';
import { Input } from '../../components/ui/Input';
import { Loader } from '../../components/ui/Loader';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { Tabs } from '../../components/ui/Tabs';
import { parseProfileTab, type ProfileTab } from '../../lib/profileTabs';
import { STORAGE_KEYS } from '../../lib/storageKeys';
import { usePageMeta } from '../../hooks/usePageMeta';

type ConsultationVehicle = {
  id: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  symptoms?: string | null;
};

type NotificationPrefs = {
  bookingReminders: boolean;
  messageAlerts: boolean;
  marketing: boolean;
};

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  bookingReminders: true,
  messageAlerts: true,
  marketing: false,
};

function loadNotificationPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.clientNotificationPrefs);
    return raw ? { ...DEFAULT_NOTIFICATION_PREFS, ...(JSON.parse(raw) as NotificationPrefs) } : DEFAULT_NOTIFICATION_PREFS;
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

function saveNotificationPrefs(prefs: NotificationPrefs) {
  localStorage.setItem(STORAGE_KEYS.clientNotificationPrefs, JSON.stringify(prefs));
}

export function ProfilePage() {
  usePageMeta({ title: 'Профиль', description: 'Контактные данные и настройки аккаунта.' });
  const { user, refreshCurrentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseProfileTab(searchParams.get('tab'));
  const isClient = user?.role === 'CLIENT';

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<ConsultationVehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName || '');
    setPhone(user.phone || '');
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setNotificationPrefs(loadNotificationPrefs());
  }, []);

  useEffect(() => {
    if (!isClient || tab !== 'vehicles') return;
    setVehiclesLoading(true);
    void api<Array<{ id: string; make?: string | null; model?: string | null; symptoms?: string | null; extracted?: { year?: number } }>>(
      '/consultations',
    )
      .then((rows) => {
        const seen = new Set<string>();
        const list: ConsultationVehicle[] = [];
        for (const row of rows) {
          const extracted = row.extracted as { make?: string; model?: string; year?: number } | undefined;
          const make = row.make || extracted?.make;
          const model = row.model || extracted?.model;
          const year = extracted?.year;
          if (!make && !model) continue;
          const key = `${make || ''}|${model || ''}|${year || ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          list.push({
            id: row.id,
            make,
            model,
            year: year ?? null,
            symptoms: row.symptoms || null,
          });
        }
        setVehicles(list);
      })
      .catch(() => setVehicles([]))
      .finally(() => setVehiclesLoading(false));
  }, [isClient, tab]);

  const profileDescription = useMemo(() => {
    if (isClient) return 'Контакты, автомобили и уведомления.';
    return 'Контактные данные аккаунта.';
  }, [isClient]);

  function setTab(next: ProfileTab) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await patchProfile({
        fullName: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      await refreshCurrentUser();
      setSuccess('Данные сохранены');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  function updateNotificationPref<K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) {
    const next = { ...notificationPrefs, [key]: value };
    setNotificationPrefs(next);
    saveNotificationPrefs(next);
  }

  if (loading) return <Loader label="Загружаем профиль..." />;
  if (!user) return <ErrorState message="Пользователь не найден" />;

  const tabItems = isClient
    ? [
        { id: 'contacts', label: 'Контакты' },
        { id: 'vehicles', label: 'Мои автомобили' },
        { id: 'notifications', label: 'Уведомления' },
        { id: 'security', label: 'Безопасность' },
      ]
    : [{ id: 'contacts', label: 'Контакты' }];

  return (
    <div className="stack dashboard-page">
      <DashboardWelcomeHero
        icon={User}
        greeting="Настройки аккаунта"
        title={user.fullName || 'Профиль'}
        description="Обновите контактные данные — менеджер сможет быстрее связаться с вами."
      />

      <PageHeader title="Профиль" description={profileDescription} />

      {isClient ? <Tabs value={tab} onChange={(next) => setTab(next as ProfileTab)} items={tabItems} /> : null}

      {tab === 'contacts' ? (
        <Card>
          <h2>Контактные данные</h2>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
          >
            <FormField label="Имя" htmlFor="profile-name">
              <Input
                id="profile-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Иван Иванов"
                autoComplete="name"
              />
            </FormField>
            <FormField label="Email" htmlFor="profile-email">
              <Input id="profile-email" value={user.email} disabled readOnly />
            </FormField>
            <FormField label="Телефон" htmlFor="profile-phone">
              <PhoneInput id="profile-phone" value={phone} onChange={setPhone} />
            </FormField>
            {error ? <p className="form-error">{error}</p> : null}
            {success ? <p className="form-success">{success}</p> : null}
            <div className="row gap-sm">
              <Button type="submit" disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </div>
          </form>
          {isClient ? (
            <p className="muted-text" style={{ marginTop: '1rem' }}>
              Email изменяется только через администратора.
            </p>
          ) : null}
        </Card>
      ) : null}

      {isClient && tab === 'vehicles' ? (
        <Card>
          <h2>Мои автомобили</h2>
          {vehiclesLoading ? <Loader label="Загружаем автомобили..." /> : null}
          {!vehiclesLoading && vehicles.length === 0 ? (
            <EmptyState
              title="Автомобили появятся после диагностики"
              description="Пройдите ИИ-диагностику — марка и модель сохранятся здесь."
              action={
                <Link className="btn btn-primary" to="/consult">
                  Начать диагностику
                </Link>
              }
            />
          ) : null}
          {!vehiclesLoading && vehicles.length > 0 ? (
            <ul className="profile-vehicle-list">
              {vehicles.map((vehicle) => {
                const title = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ');
                const filter = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
                return (
                  <li key={vehicle.id} className="profile-vehicle-item">
                    <span className="profile-vehicle-icon" aria-hidden>
                      <Car size={18} />
                    </span>
                    <div>
                      <strong>{title || 'Автомобиль'}</strong>
                      {vehicle.symptoms ? <p className="muted-text">{vehicle.symptoms}</p> : null}
                    </div>
                    <Link
                      className="btn btn-ghost btn-sm"
                      to={`/dashboard/client/cases?tab=active${filter ? `&q=${encodeURIComponent(filter)}` : ''}`}
                    >
                      Обращения
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {isClient && tab === 'notifications' ? (
        <Card>
          <h2>Уведомления</h2>
          <p className="muted-text">Настройки сохраняются на этом устройстве. Push-уведомления появятся позже.</p>
          <div className="profile-toggle-list">
            <label className="profile-toggle">
              <input
                type="checkbox"
                checked={notificationPrefs.bookingReminders}
                onChange={(e) => updateNotificationPref('bookingReminders', e.target.checked)}
              />
              <span>Напоминания о записи</span>
            </label>
            <label className="profile-toggle">
              <input
                type="checkbox"
                checked={notificationPrefs.messageAlerts}
                onChange={(e) => updateNotificationPref('messageAlerts', e.target.checked)}
              />
              <span>Новые сообщения от менеджера</span>
            </label>
            <label className="profile-toggle">
              <input
                type="checkbox"
                checked={notificationPrefs.marketing}
                onChange={(e) => updateNotificationPref('marketing', e.target.checked)}
              />
              <span>Акции и спецпредложения</span>
            </label>
          </div>
        </Card>
      ) : null}

      {isClient && tab === 'security' ? (
        <Card>
          <h2>Безопасность</h2>
          <p className="muted-text">
            Смена пароля через кабинет появится в следующем обновлении. Сейчас обратитесь к администратору или
            воспользуйтесь восстановлением доступа на странице входа.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
