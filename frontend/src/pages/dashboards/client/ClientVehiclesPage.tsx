import { Link } from 'react-router-dom';
import { Car, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  createVehicle,
  deleteVehicle,
  formatVehicleTitle,
  listVehicles,
  type ClientVehicle,
} from '../../../api/vehicles';
import { listMaintenanceAlerts } from '../../../api/serviceRecords';
import { ClientVehicleCard } from '../../../components/client/ClientVehicleCard';
import { PageHeader } from '../../../components/layout/dashboard/PageHeader';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FormField } from '../../../components/forms/FormField';
import { Input } from '../../../components/ui/Input';
import { Loader } from '../../../components/ui/Loader';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Modal } from '../../../components/ui/Modal';
import { pluralizeVehicles } from '../../../lib/russianPlural';
import { usePageMeta } from '../../../hooks/usePageMeta';

type VehicleFormErrors = {
  make?: string;
  model?: string;
  year?: string;
  vin?: string;
};

export function ClientVehiclesPage() {
  usePageMeta({ title: 'Мой гараж', description: 'Автомобили, фото, пробег и сервисная история.' });
  const [vehicles, setVehicles] = useState<ClientVehicle[]>([]);
  const [oilByVehicle, setOilByVehicle] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleVin, setVehicleVin] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<VehicleFormErrors>({});
  const [deleteVehicleId, setDeleteVehicleId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function reload() {
    const [rows, alerts] = await Promise.all([
      listVehicles(),
      listMaintenanceAlerts().catch(() => []),
    ]);
    setVehicles(rows);
    setOilByVehicle(
      Object.fromEntries(alerts.map((a) => [a.vehicleId, a.status])),
    );
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    void reload()
      .catch((e) => {
        setVehicles([]);
        setError(e instanceof Error ? e.message : 'Не удалось загрузить автомобили');
      })
      .finally(() => setLoading(false));
  }, []);

  function resetForm() {
    setVehicleMake('');
    setVehicleModel('');
    setVehicleYear('');
    setVehicleVin('');
    setVehiclePlate('');
    setVehicleColor('');
    setFormErrors({});
  }

  function openAdd() {
    resetForm();
    setAddOpen(true);
  }

  async function handleAdd(e: React.FormEvent) {
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
    const vinValue = vehicleVin.trim().toUpperCase();
    if (vinValue && !/^[A-HJ-NPR-Z0-9]{11,17}$/i.test(vinValue)) {
      nextErrors.vin = 'VIN: 11–17 символов без I, O, Q';
    }
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setError(null);
    try {
      await createVehicle({
        make: vehicleMake.trim(),
        model: vehicleModel.trim(),
        year: yearValue ? Number(yearValue) : null,
        vin: vinValue || null,
        licensePlate: vehiclePlate.trim().toUpperCase() || null,
        color: vehicleColor.trim() || null,
      });
      setAddOpen(false);
      resetForm();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить автомобиль');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteVehicleId) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteVehicle(deleteVehicleId);
      setDeleteVehicleId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить автомобиль');
    } finally {
      setDeleting(false);
    }
  }

  const countLabel = loading
    ? undefined
    : `${vehicles.length} ${pluralizeVehicles(vehicles.length)} · фото, пробег и сервис`;

  const previewTitle =
    vehicleMake.trim() || vehicleModel.trim()
      ? formatVehicleTitle({
          make: vehicleMake.trim(),
          model: vehicleModel.trim(),
          year: vehicleYear.trim() ? Number(vehicleYear) : null,
        })
      : vehicleYear.trim()
        ? String(Number(vehicleYear))
        : 'Марка и модель';
  const previewReady = Boolean(
    vehicleMake.trim() ||
      vehicleModel.trim() ||
      vehicleYear.trim() ||
      vehicleVin.trim() ||
      vehiclePlate.trim() ||
      vehicleColor.trim(),
  );
  const previewMeta = [
    vehiclePlate.trim().toUpperCase() || null,
    vehicleColor.trim() || null,
    vehicleVin.trim() ? `VIN ${vehicleVin.trim().toUpperCase()}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="stack dashboard-page client-vehicles-page">
      <PageHeader
        title="Мой гараж"
        description={countLabel}
        actions={
          <Button type="button" onClick={openAdd}>
            <Plus size={16} aria-hidden />
            Добавить
          </Button>
        }
      />

      {error ? <p className="form-error">{error}</p> : null}

      {loading ? <Loader label="Загружаем гараж..." /> : null}

      {!loading && vehicles.length === 0 ? (
        <EmptyState
          title="Гараж пуст"
          description="Добавьте автомобиль с фото и данными — или пройдите диагностику, машина появится здесь."
          action={
            <div className="row gap-sm">
              <Button type="button" onClick={openAdd}>
                Добавить автомобиль
              </Button>
              <Link className="btn btn-secondary" to="/consult">
                Диагностика
              </Link>
            </div>
          }
        />
      ) : null}

      {!loading && vehicles.length > 0 ? (
        <div className="garage-vehicle-grid">
          {vehicles.map((vehicle) => (
            <ClientVehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              onDelete={setDeleteVehicleId}
              oilStatus={oilByVehicle[vehicle.id]}
            />
          ))}
        </div>
      ) : null}

      <Modal
        open={addOpen}
        title="Добавить автомобиль"
        onClose={() => setAddOpen(false)}
        className="modal-add-vehicle"
      >
        <form className="add-vehicle-form" onSubmit={(e) => void handleAdd(e)}>
          <p className="add-vehicle-lead">
            Машина появится в гараже. Фото можно добавить сразу на карточке авто.
          </p>

          <div
            className={`add-vehicle-preview${previewReady ? ' is-ready' : ''}`}
            aria-live="polite"
          >
            <span className="add-vehicle-preview-icon" aria-hidden>
              <Car size={18} />
            </span>
            <div className="add-vehicle-preview-body">
              <strong>{previewTitle}</strong>
              <span>{previewMeta || 'Как будет выглядеть в гараже'}</span>
            </div>
          </div>

          <div className="add-vehicle-grid">
            <FormField label="Марка" htmlFor="vehicle-make" error={formErrors.make}>
              <Input
                id="vehicle-make"
                required
                value={vehicleMake}
                onChange={(e) => {
                  setVehicleMake(e.target.value);
                  if (formErrors.make) setFormErrors((prev) => ({ ...prev, make: undefined }));
                }}
                placeholder="Toyota"
                autoComplete="off"
                autoFocus
              />
            </FormField>
            <FormField label="Модель" htmlFor="vehicle-model" error={formErrors.model}>
              <Input
                id="vehicle-model"
                required
                value={vehicleModel}
                onChange={(e) => {
                  setVehicleModel(e.target.value);
                  if (formErrors.model) setFormErrors((prev) => ({ ...prev, model: undefined }));
                }}
                placeholder="Camry"
                autoComplete="off"
              />
            </FormField>
          </div>

          <div className="add-vehicle-grid add-vehicle-grid-meta">
            <FormField label="Год" htmlFor="vehicle-year" hint="необязательно" error={formErrors.year}>
              <Input
                id="vehicle-year"
                type="number"
                inputMode="numeric"
                value={vehicleYear}
                onChange={(e) => {
                  setVehicleYear(e.target.value);
                  if (formErrors.year) setFormErrors((prev) => ({ ...prev, year: undefined }));
                }}
                placeholder="2018"
              />
            </FormField>
            <FormField label="Госномер" htmlFor="vehicle-plate" hint="необязательно">
              <Input
                id="vehicle-plate"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                placeholder="А123ВС777"
                autoComplete="off"
                spellCheck={false}
              />
            </FormField>
          </div>

          <div className="add-vehicle-grid">
            <FormField label="Цвет" htmlFor="vehicle-color" hint="необязательно">
              <Input
                id="vehicle-color"
                value={vehicleColor}
                onChange={(e) => setVehicleColor(e.target.value)}
                placeholder="Белый"
                autoComplete="off"
              />
            </FormField>
            <FormField label="VIN" htmlFor="vehicle-vin" hint="необязательно" error={formErrors.vin}>
              <Input
                id="vehicle-vin"
                value={vehicleVin}
                onChange={(e) => {
                  setVehicleVin(e.target.value.toUpperCase());
                  if (formErrors.vin) setFormErrors((prev) => ({ ...prev, vin: undefined }));
                }}
                placeholder="XTA211440Y0123456"
                autoComplete="off"
                spellCheck={false}
              />
            </FormField>
          </div>

          <div className="add-vehicle-actions">
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Сохранение...' : 'Добавить'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteVehicleId)}
        title="Удалить автомобиль?"
        text="Автомобиль исчезнет из гаража. История обращений сохранится — вы сможете найти её в общем списке."
        onCancel={() => setDeleteVehicleId(null)}
        onConfirm={() => void handleDelete()}
      />
      {deleting ? <Loader label="Удаляем автомобиль..." /> : null}
    </div>
  );
}
