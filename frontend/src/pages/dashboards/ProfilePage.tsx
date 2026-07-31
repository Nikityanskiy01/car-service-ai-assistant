import { Link, useSearchParams } from 'react-router-dom';
import { Car, Plus, Trash2, User } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { patchProfile } from '../../api/dashboard';
import {
  createVehicle,
  deleteVehicle,
  formatVehicleTitle,
  listVehicles,
  type ClientVehicle,
} from '../../api/vehicles';
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
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { parseProfileTab, type ProfileTab } from '../../lib/profileTabs';
import { formatVehicleCasesLabel } from '../../lib/russianPlural';
import { STORAGE_KEYS } from '../../lib/storageKeys';
import { usePageMeta } from '../../hooks/usePageMeta';

type VehicleFormErrors = {
  make?: string;
  model?: string;
  year?: string;
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
  const [vehicles, setVehicles] = useState<ClientVehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleSaving, setVehicleSaving] = useState(false);
  const [vehicleFormErrors, setVehicleFormErrors] = useState<VehicleFormErrors>({});
  const [deleteVehicleId, setDeleteVehicleId] = useState<string | null>(null);
  const [vehicleDeleting, setVehicleDeleting] = useState(false);
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
    setVehiclesError(null);
    void listVehicles()
      .then(setVehicles)
      .catch((e) => {
        setVehicles([]);
        setVehiclesError(e instanceof Error ? e.message : 'Не удалось загрузить автомобили');
      })
      .finally(() => setVehiclesLoading(false));
  }, [isClient, tab]);

  async function reloadVehicles() {
    const rows = await listVehicles();
    setVehicles(rows);
  }

  function resetVehicleForm() {
    setVehicleMake('');
    setVehicleModel('');
    setVehicleYear('');
    setVehicleFormErrors({});
  }

  function openAddVehicle() {
    resetVehicleForm();
    setAddVehicleOpen(true);
  }

  async function handleAddVehicle(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: VehicleFormErrors = {};
    if (!vehicleMake.trim()) nextErrors.make = 'Укажите марку';
    if (!vehicleModel.trim()) nextErrors.model = 'Укажите модель';
    const yearValue = vehicleYear.trim();
    if (yearValue) {
      const year = Number(yearValue);
      if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1) {
        nextErrors.year = 'Некорректный год';
      }
    }
    setVehicleFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setVehicleSaving(true);
    setVehiclesError(null);
    try {
      await createVehicle({
        make: vehicleMake.trim(),
        model: vehicleModel.trim(),
        year: yearValue ? Number(yearValue) : null,
      });
      setAddVehicleOpen(false);
      resetVehicleForm();
      await reloadVehicles();
    } catch (err) {
      setVehiclesError(err instanceof Error ? err.message : 'Не удалось добавить автомобиль');
    } finally {
      setVehicleSaving(false);
    }
  }

  async function handleDeleteVehicle() {
    if (!deleteVehicleId) return;
    setVehicleDeleting(true);
    setVehiclesError(null);
    try {
      await deleteVehicle(deleteVehicleId);
      setDeleteVehicleId(null);
      await reloadVehicles();
    } catch (err) {
      setVehiclesError(err instanceof Error ? err.message : 'Не удалось удалить автомобиль');
    } finally {
      setVehicleDeleting(false);
    }
  }

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
          <div className="profile-vehicle-header">
            <div>
              <h2>Мои автомобили</h2>
              <p className="muted-text">Добавляйте машины вручную или они появятся после ИИ-диагностики.</p>
            </div>
            <Button type="button" onClick={openAddVehicle}>
              <Plus size={16} aria-hidden />
              Добавить
            </Button>
          </div>

          {vehiclesError ? <p className="form-error">{vehiclesError}</p> : null}
          {vehiclesLoading ? <Loader label="Загружаем автомобили..." /> : null}
          {!vehiclesLoading && vehicles.length === 0 ? (
            <EmptyState
              title="Гараж пуст"
              description="Добавьте автомобиль вручную или пройдите ИИ-диагностику — машина сохранится здесь автоматически."
              action={
                <div className="row gap-sm">
                  <Button type="button" onClick={openAddVehicle}>
                    Добавить автомобиль
                  </Button>
                  <Link className="btn btn-secondary" to="/consult">
                    Начать диагностику
                  </Link>
                </div>
              }
            />
          ) : null}
          {!vehiclesLoading && vehicles.length > 0 ? (
            <ul className="profile-vehicle-list">
              {vehicles.map((vehicle) => {
                const title = formatVehicleTitle(vehicle);
                const casesLabel = formatVehicleCasesLabel(vehicle);
                return (
                  <li key={vehicle.id} className="profile-vehicle-item">
                    <span className="profile-vehicle-icon" aria-hidden>
                      <Car size={18} />
                    </span>
                    <div className="profile-vehicle-body">
                      <strong>{title}</strong>
                      <p className="muted-text">{casesLabel}</p>
                      {vehicle.notes ? <p className="muted-text">{vehicle.notes}</p> : null}
                    </div>
                    <div className="profile-vehicle-actions">
                      <Link
                        className="btn btn-ghost btn-sm"
                        to={`/dashboard/client/cases?tab=active&vehicleId=${encodeURIComponent(vehicle.id)}`}
                      >
                        Обращения
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        className="btn-icon-danger"
                        aria-label={`Удалить ${title}`}
                        onClick={() => setDeleteVehicleId(vehicle.id)}
                      >
                        <Trash2 size={16} aria-hidden />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <Modal open={addVehicleOpen} title="Добавить автомобиль" onClose={() => setAddVehicleOpen(false)}>
            <form className="stack" onSubmit={(e) => void handleAddVehicle(e)}>
              <FormField label="Марка" htmlFor="vehicle-make" error={vehicleFormErrors.make}>
                <Input
                  id="vehicle-make"
                  value={vehicleMake}
                  onChange={(e) => {
                    setVehicleMake(e.target.value);
                    if (vehicleFormErrors.make) setVehicleFormErrors((prev) => ({ ...prev, make: undefined }));
                  }}
                  placeholder="Toyota"
                  autoComplete="off"
                />
              </FormField>
              <FormField label="Модель" htmlFor="vehicle-model" error={vehicleFormErrors.model}>
                <Input
                  id="vehicle-model"
                  value={vehicleModel}
                  onChange={(e) => {
                    setVehicleModel(e.target.value);
                    if (vehicleFormErrors.model) setVehicleFormErrors((prev) => ({ ...prev, model: undefined }));
                  }}
                  placeholder="Camry"
                  autoComplete="off"
                />
              </FormField>
              <FormField label="Год выпуска" htmlFor="vehicle-year" hint="Необязательно" error={vehicleFormErrors.year}>
                <Input
                  id="vehicle-year"
                  type="number"
                  inputMode="numeric"
                  value={vehicleYear}
                  onChange={(e) => {
                    setVehicleYear(e.target.value);
                    if (vehicleFormErrors.year) setVehicleFormErrors((prev) => ({ ...prev, year: undefined }));
                  }}
                  placeholder="2018"
                />
              </FormField>
              <div className="row gap-sm">
                <Button type="submit" disabled={vehicleSaving}>
                  {vehicleSaving ? 'Сохранение...' : 'Добавить'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setAddVehicleOpen(false)}>
                  Отмена
                </Button>
              </div>
            </form>
          </Modal>

          <ConfirmDialog
            open={Boolean(deleteVehicleId)}
            title="Удалить автомобиль?"
            text="Автомобиль исчезнет из гаража. История обращений сохранится — вы сможете найти её в общем списке."
            onCancel={() => setDeleteVehicleId(null)}
            onConfirm={() => void handleDeleteVehicle()}
          />
          {vehicleDeleting ? <Loader label="Удаляем автомобиль..." /> : null}
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
