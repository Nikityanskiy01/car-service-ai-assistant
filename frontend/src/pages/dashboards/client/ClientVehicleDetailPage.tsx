import {
  ArrowLeft,
  CalendarPlus,
  Download,
  Droplets,
  FileImage,
  Gauge,
  Hash,
  Palette,
  Plus,
  Trash2,
  Wrench,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createServiceRecord,
  deleteServiceRecord,
  getMaintenancePlan,
  listServiceRecords,
  type MaintenancePlan,
  type ServiceRecord,
  type ServiceRecordCategory,
} from '../../../api/serviceRecords';
import {
  formatVehicleTitle,
  getVehicle,
  updateVehicle,
  type ClientVehicle,
} from '../../../api/vehicles';
import { VehiclePhotoPicker } from '../../../components/client/VehiclePhotoPicker';
import { PageHeader } from '../../../components/layout/dashboard/PageHeader';
import { FormField } from '../../../components/forms/FormField';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Input } from '../../../components/ui/Input';
import { Loader } from '../../../components/ui/Loader';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { prefillOilChangeBookingFromPlan } from '../../../features/consultations/bookingPrefill';
import { usePageMeta } from '../../../hooks/usePageMeta';
import { formatVehicleCasesLabel } from '../../../lib/russianPlural';

const CATEGORY_OPTIONS: Array<{ id: ServiceRecordCategory; label: string; title: string }> = [
  { id: 'oil_change', label: 'Масло', title: 'Замена масла ДВС' },
  { id: 'maintenance', label: 'ТО', title: 'Плановое ТО' },
  { id: 'brakes', label: 'Тормоза', title: 'Тормозная система' },
  { id: 'filters', label: 'Фильтры', title: 'Замена фильтров' },
  { id: 'tires', label: 'Шины', title: 'Шиномонтаж' },
  { id: 'other', label: 'Прочее', title: 'Выполненные работы' },
];

function statusLabel(status?: string) {
  if (status === 'overdue') return 'Просрочено';
  if (status === 'soon') return 'Скоро';
  if (status === 'ok') return 'В норме';
  return 'Нет данных';
}

function formatMoney(minor?: number | null) {
  if (minor == null) return null;
  return `${Math.round(minor / 100).toLocaleString('ru-RU')} ₽`;
}

function categoryLabel(category: string) {
  return CATEGORY_OPTIONS.find((o) => o.id === category)?.title || 'Работы';
}

function categoryTitle(category: ServiceRecordCategory) {
  return CATEGORY_OPTIONS.find((o) => o.id === category)?.title || 'Выполненные работы';
}

export function ClientVehicleDetailPage() {
  const { vehicleId = '' } = useParams();
  const navigate = useNavigate();
  usePageMeta({
    title: 'Автомобиль',
    description: 'Фото, данные, сервисная книжка и план ТО.',
  });

  const [vehicle, setVehicle] = useState<ClientVehicle | null>(null);
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [plan, setPlan] = useState<MaintenancePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [mileageDraft, setMileageDraft] = useState('');
  const [savingMileage, setSavingMileage] = useState(false);
  const [plateDraft, setPlateDraft] = useState('');
  const [colorDraft, setColorDraft] = useState('');
  const [vinDraft, setVinDraft] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);

  const [title, setTitle] = useState('Замена масла ДВС');
  const [category, setCategory] = useState<ServiceRecordCategory>('oil_change');
  const [titleCustomized, setTitleCustomized] = useState(false);
  const [performedAt, setPerformedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [mileageKm, setMileageKm] = useState('');
  const [worksDone, setWorksDone] = useState('');
  const [workOrderNumber, setWorkOrderNumber] = useState('');
  const [amountRub, setAmountRub] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);

  const reload = useCallback(async () => {
    const [v, rows, p] = await Promise.all([
      getVehicle(vehicleId),
      listServiceRecords(vehicleId),
      getMaintenancePlan(vehicleId),
    ]);
    setVehicle(v);
    setRecords(rows);
    setPlan(p);
    setMileageDraft(v.currentMileageKm != null ? String(v.currentMileageKm) : '');
    setPlateDraft(v.licensePlate || '');
    setColorDraft(v.color || '');
    setVinDraft(v.vin || '');
  }, [vehicleId]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void reload()
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить историю');
        setVehicle(null);
      })
      .finally(() => setLoading(false));
  }, [reload]);

  async function handleSaveMileage(e: FormEvent) {
    e.preventDefault();
    if (!vehicle) return;
    setSavingMileage(true);
    setError(null);
    try {
      const updated = await updateVehicle(vehicle.id, {
        currentMileageKm: mileageDraft.trim() ? Number(mileageDraft) : null,
      });
      setVehicle(updated);
      const p = await getMaintenancePlan(vehicle.id);
      setPlan(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить пробег');
    } finally {
      setSavingMileage(false);
    }
  }

  async function handleSaveMeta(e: FormEvent) {
    e.preventDefault();
    if (!vehicle) return;
    setSavingMeta(true);
    setError(null);
    try {
      const updated = await updateVehicle(vehicle.id, {
        licensePlate: plateDraft.trim().toUpperCase() || null,
        color: colorDraft.trim() || null,
        vin: vinDraft.trim().toUpperCase() || null,
      });
      setVehicle(updated);
      setPlateDraft(updated.licensePlate || '');
      setColorDraft(updated.color || '');
      setVinDraft(updated.vin || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить данные');
    } finally {
      setSavingMeta(false);
    }
  }

  const mileageHistory = useMemo(() => {
    const points = records
      .filter((r) => r.mileageKm != null && Number.isFinite(r.mileageKm))
      .map((r) => ({
        id: r.id,
        performedAt: r.performedAt,
        mileageKm: Number(r.mileageKm),
        title: r.title,
        category: r.category,
      }))
      .sort((a, b) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime());

    return points.map((point, index) => {
      const prev = index > 0 ? points[index - 1] : null;
      const delta = prev ? point.mileageKm - prev.mileageKm : null;
      return { ...point, delta };
    });
  }, [records]);

  function openAddModal(preset?: ServiceRecordCategory) {
    const nextCategory = preset || 'oil_change';
    setCategory(nextCategory);
    setTitle(categoryTitle(nextCategory));
    setTitleCustomized(false);
    setPerformedAt(new Date().toISOString().slice(0, 10));
    setMileageKm(
      mileageDraft.trim() ||
        (vehicle?.currentMileageKm != null ? String(vehicle.currentMileageKm) : ''),
    );
    setWorksDone('');
    setWorkOrderNumber('');
    setAmountRub('');
    setDetailsOpen(false);
    setAddOpen(true);
  }

  function selectCategory(next: ServiceRecordCategory) {
    setCategory(next);
    if (!titleCustomized) setTitle(categoryTitle(next));
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createServiceRecord(vehicleId, {
        title: title.trim() || categoryTitle(category),
        category,
        performedAt: performedAt ? new Date(performedAt).toISOString() : undefined,
        mileageKm: mileageKm.trim() ? Number(mileageKm) : null,
        worksDone: worksDone.trim() || null,
        workOrderNumber: workOrderNumber.trim() || null,
        amountMinor: amountRub.trim() ? Math.round(Number(amountRub) * 100) : null,
      });
      setAddOpen(false);
      setWorksDone('');
      setWorkOrderNumber('');
      setAmountRub('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить запись');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteServiceRecord(deleteId);
      setDeleteId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить запись');
      setDeleteId(null);
    }
  }

  function bookOilChange() {
    if (!vehicle) return;
    prefillOilChangeBookingFromPlan({
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      nextDueAt: plan?.plan?.nextDueAt,
      nextDueMileage: plan?.plan?.nextDueMileage,
    });
    navigate('/booking');
  }

  if (loading) return <Loader label="Загружаем сервисную книжку…" />;
  if (!vehicle) {
    return (
      <EmptyState
        title="Автомобиль не найден"
        description={error || 'Вернитесь в гараж и выберите машину.'}
        action={
          <Link to="/dashboard/client/vehicles" className="btn btn-primary">
            К гаражу
          </Link>
        }
      />
    );
  }

  const titleText = formatVehicleTitle(vehicle);
  const oilStatus = plan?.status || 'unknown';
  const accentClass =
    oilStatus === 'overdue'
      ? 'is-accent-overdue'
      : oilStatus === 'soon'
        ? 'is-accent-soon'
        : oilStatus === 'ok'
          ? 'is-accent-ok'
          : 'is-accent-muted';
  const casesLabel = formatVehicleCasesLabel(vehicle);

  return (
    <div className="client-vehicle-detail stack">
      <Link to="/dashboard/client/vehicles" className="service-book-back">
        <ArrowLeft size={16} aria-hidden />
        К гаражу
      </Link>

      <PageHeader
        title={titleText}
        description="Карточка авто, фото, пробег и сервисная книжка."
        actions={
          <Button type="button" onClick={() => openAddModal()}>
            <Plus size={16} aria-hidden />
            Добавить работу
          </Button>
        }
      />

      {error ? <p className="form-error">{error}</p> : null}

      <section className="garage-vehicle-hero" aria-label="Карточка автомобиля">
        <VehiclePhotoPicker
          vehicle={vehicle}
          onUpdated={(updated) => {
            setVehicle(updated);
          }}
        />
        <div className="garage-vehicle-hero-body">
          <div className="garage-vehicle-hero-facts">
            <div>
              <span className="garage-vehicle-hero-label">Пробег</span>
              <strong>
                {vehicle.currentMileageKm != null
                  ? `${vehicle.currentMileageKm.toLocaleString('ru-RU')} км`
                  : 'не указан'}
              </strong>
            </div>
            <div>
              <span className="garage-vehicle-hero-label">Обращения</span>
              <strong>{casesLabel}</strong>
            </div>
            <div>
              <span className="garage-vehicle-hero-label">Последний сервис</span>
              <strong>
                {vehicle.lastServiceAt
                  ? new Date(vehicle.lastServiceAt).toLocaleDateString('ru-RU')
                  : 'нет записей'}
              </strong>
              {vehicle.lastServiceTitle ? (
                <span className="muted garage-vehicle-hero-sub">{vehicle.lastServiceTitle}</span>
              ) : null}
            </div>
            <div>
              <span className="garage-vehicle-hero-label">Масло</span>
              <strong>{statusLabel(oilStatus)}</strong>
            </div>
          </div>

          <form className="garage-vehicle-meta-form" onSubmit={(e) => void handleSaveMeta(e)}>
            <FormField label="Госномер" htmlFor="vehicle-plate-edit">
              <Input
                id="vehicle-plate-edit"
                value={plateDraft}
                onChange={(e) => setPlateDraft(e.target.value.toUpperCase())}
                placeholder="А123ВС777"
                spellCheck={false}
              />
            </FormField>
            <FormField label="Цвет" htmlFor="vehicle-color-edit">
              <Input
                id="vehicle-color-edit"
                value={colorDraft}
                onChange={(e) => setColorDraft(e.target.value)}
                placeholder="Белый"
              />
            </FormField>
            <FormField label="VIN" htmlFor="vehicle-vin-edit">
              <Input
                id="vehicle-vin-edit"
                value={vinDraft}
                onChange={(e) => setVinDraft(e.target.value.toUpperCase())}
                placeholder="XTA211440Y0123456"
                spellCheck={false}
              />
            </FormField>
            <div className="garage-vehicle-meta-actions">
              <Button type="submit" variant="secondary" disabled={savingMeta}>
                {savingMeta ? 'Сохранение…' : 'Сохранить данные'}
              </Button>
              <Button type="button" onClick={bookOilChange}>
                <CalendarPlus size={16} aria-hidden />
                Записаться
              </Button>
            </div>
          </form>

          <ul className="garage-vehicle-hero-chips" aria-label="Краткие данные">
            {vehicle.year ? (
              <li>
                <Hash size={13} aria-hidden />
                {vehicle.year} г.
              </li>
            ) : null}
            {vehicle.color ? (
              <li>
                <Palette size={13} aria-hidden />
                {vehicle.color}
              </li>
            ) : null}
            {vehicle.licensePlate ? (
              <li className="garage-plate">{vehicle.licensePlate}</li>
            ) : null}
          </ul>
        </div>
      </section>

      <section
        className={`service-oil-plan client-overview-focus-primary ${accentClass}`}
        data-status={oilStatus}
        aria-label="План замены масла"
      >
        <div className="client-overview-focus-primary-inner service-oil-plan-inner">
          <div className="client-overview-focus-primary-head">
            <span className="client-overview-focus-primary-icon" aria-hidden>
              <Droplets size={20} strokeWidth={2.1} />
            </span>
            <div className="service-oil-copy">
              <p className="client-overview-focus-kicker">Замена масла</p>
              <strong className="service-oil-title">Следующая замена</strong>
              <p className="service-oil-reglament muted">
                Регламент: 7500 км или 6 месяцев — что раньше
              </p>
            </div>
          </div>
          <span className="service-oil-status">{statusLabel(oilStatus)}</span>
        </div>

        {plan?.hasHistory && plan.plan ? (
          <div className="service-oil-plan-body">
            <div className="service-oil-metrics" role="list">
              <div className="service-oil-metric" role="listitem">
                <span className="service-oil-metric-label">Последняя</span>
                <strong>
                  {plan.lastRecord?.performedAt
                    ? new Date(plan.lastRecord.performedAt).toLocaleDateString('ru-RU')
                    : '—'}
                </strong>
                <span className="muted">
                  {plan.lastRecord?.mileageKm != null
                    ? `${plan.lastRecord.mileageKm.toLocaleString('ru-RU')} км`
                    : 'пробег не указан'}
                </span>
              </div>
              <div className="service-oil-metric is-next" role="listitem">
                <span className="service-oil-metric-label">Следующая</span>
                <strong>
                  {plan.plan.nextDueAt
                    ? new Date(plan.plan.nextDueAt).toLocaleDateString('ru-RU')
                    : '—'}
                </strong>
                <span className="muted">
                  {plan.plan.nextDueMileage != null
                    ? `${plan.plan.nextDueMileage.toLocaleString('ru-RU')} км`
                    : 'по дате'}
                </span>
              </div>
            </div>
            <div className="service-oil-plan-actions">
              <Button type="button" onClick={bookOilChange}>
                <CalendarPlus size={16} aria-hidden />
                Записаться
              </Button>
              <a
                className="btn btn-secondary"
                href={`/api/vehicles/${vehicle.id}/service-history/export.pdf`}
              >
                <Download size={16} aria-hidden />
                PDF истории
              </a>
            </div>
          </div>
        ) : (
          <div className="service-oil-plan-body service-oil-plan-empty">
            <p className="muted">
              Пока нет записей о замене масла. Добавьте прошлую замену — рассчитаем следующий срок.
            </p>
            <Button type="button" variant="secondary" onClick={() => openAddModal('oil_change')}>
              Указать замену масла
            </Button>
          </div>
        )}
      </section>

      <section className="service-mileage-panel" aria-label="Пробег">
        <div className="service-mileage-panel-head">
          <span className="service-mileage-icon" aria-hidden>
            <Gauge size={18} />
          </span>
          <div>
            <strong>Пробег</strong>
            <p className="muted">Текущее значение и история по записям обслуживания</p>
          </div>
        </div>
        <form className="service-mileage-form" onSubmit={(e) => void handleSaveMileage(e)}>
          <FormField label="Сейчас, км" htmlFor="vehicle-mileage">
            <Input
              id="vehicle-mileage"
              type="number"
              min={0}
              value={mileageDraft}
              onChange={(e) => setMileageDraft(e.target.value)}
              placeholder="например 45200"
            />
          </FormField>
          <Button type="submit" variant="secondary" disabled={savingMileage}>
            {savingMileage ? 'Сохранение…' : 'Обновить'}
          </Button>
        </form>

        {mileageHistory.length > 0 ? (
          <div className="service-mileage-history">
            <h3 className="service-mileage-history-title">История пробега</h3>
            <ol className="service-mileage-timeline">
              {[...mileageHistory].reverse().map((point) => (
                <li key={point.id} className="service-mileage-point">
                  <span className="service-mileage-point-dot" aria-hidden />
                  <div className="service-mileage-point-body">
                    <div className="service-mileage-point-top">
                      <strong>{point.mileageKm.toLocaleString('ru-RU')} км</strong>
                      {point.delta != null && point.delta > 0 ? (
                        <span className="service-mileage-delta">+{point.delta.toLocaleString('ru-RU')} км</span>
                      ) : null}
                    </div>
                    <div className="service-mileage-point-meta">
                      <span>{new Date(point.performedAt).toLocaleDateString('ru-RU')}</span>
                      <span>{point.title}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="service-mileage-empty muted">
            История появится, когда в работах укажете пробег — или добавьте запись обслуживания.
          </p>
        )}
      </section>

      <section className="service-records-panel" aria-label="История работ">
        <header className="service-records-header">
          <div>
            <h2>История работ</h2>
            <p className="muted">
              {records.length
                ? `${records.length} ${records.length === 1 ? 'запись' : records.length < 5 ? 'записи' : 'записей'}`
                : 'Пока пусто'}
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => openAddModal()}>
            <Plus size={16} aria-hidden />
            Добавить
          </Button>
        </header>

        {records.length === 0 ? (
          <EmptyState
            title="История пуста"
            description="Добавьте выполненные работы вручную или дождитесь закрытия ремонта в сервисе."
            action={
              <Button type="button" onClick={() => openAddModal()}>
                Добавить работу
              </Button>
            }
          />
        ) : (
          <ul className="service-record-rows">
            {records.map((record) => {
              const day = new Date(record.performedAt);
              return (
                <li key={record.id} className="service-record-row">
                  <div className="service-record-date" aria-hidden>
                    <span className="service-record-date-day">
                      {day.toLocaleDateString('ru-RU', { day: '2-digit' })}
                    </span>
                    <span className="service-record-date-month">
                      {day.toLocaleDateString('ru-RU', { month: 'short' })}
                    </span>
                  </div>
                  <span className="service-record-icon" aria-hidden>
                    {record.category === 'oil_change' ? <Droplets size={16} /> : <Wrench size={16} />}
                  </span>
                  <div className="service-record-main">
                    <div className="service-record-titles">
                      <strong>{record.title}</strong>
                      <span className="service-record-cat">{categoryLabel(String(record.category))}</span>
                    </div>
                    <div className="case-card-meta">
                      {record.mileageKm != null ? (
                        <span>{record.mileageKm.toLocaleString('ru-RU')} км</span>
                      ) : null}
                      {record.workOrderNumber ? <span>ЗН {record.workOrderNumber}</span> : null}
                      {formatMoney(record.amountMinor) ? (
                        <span>{formatMoney(record.amountMinor)}</span>
                      ) : null}
                      <span className="service-record-source">
                        {record.source === 'manager_feedback' ? 'Сервис' : 'Вручную'}
                      </span>
                    </div>
                    {record.worksDone ? <p className="service-record-note">{record.worksDone}</p> : null}
                  </div>
                  <div className="service-record-actions">
                    <a
                      className="btn btn-secondary btn-sm"
                      href={`/api/service-records/${record.id}/export.pdf`}
                      title="Скачать PDF"
                    >
                      <Download size={14} aria-hidden />
                      PDF
                    </a>
                    <a
                      className="btn btn-secondary btn-sm"
                      href={`/api/service-records/${record.id}/export.jpg`}
                      title="Скачать JPEG"
                    >
                      <FileImage size={14} aria-hidden />
                      JPEG
                    </a>
                    {record.source === 'client_manual' ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="btn-icon-danger"
                        aria-label="Удалить запись"
                        onClick={() => setDeleteId(record.id)}
                      >
                        <Trash2 size={14} aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Добавить работу"
        className="modal-service-record"
      >
        <form className="service-record-form" onSubmit={(e) => void handleAdd(e)}>
          <p className="service-record-form-lead">
            Запись попадёт в сервисную книжку
            {category === 'oil_change' ? ' и обновит план замены масла' : ''}.
          </p>

          <div
            className={`service-record-preview${title.trim() || performedAt ? ' is-ready' : ''}`}
            aria-live="polite"
          >
            <span className="service-record-preview-icon" aria-hidden>
              {category === 'oil_change' ? <Droplets size={18} /> : <Wrench size={18} />}
            </span>
            <div className="service-record-preview-body">
              <strong>{title.trim() || categoryTitle(category)}</strong>
              <span>
                {[
                  performedAt ? new Date(performedAt).toLocaleDateString('ru-RU') : null,
                  mileageKm.trim() ? `${Number(mileageKm).toLocaleString('ru-RU')} км` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Укажите дату и пробег'}
              </span>
            </div>
          </div>

          <fieldset className="service-record-cats">
            <legend className="service-record-cats-label">Тип работ</legend>
            <div className="service-record-cat-chips" role="group" aria-label="Тип работ">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`service-record-cat-chip${category === opt.id ? ' is-active' : ''}`}
                  aria-pressed={category === opt.id}
                  onClick={() => selectCategory(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="service-record-form-grid service-record-form-grid-primary">
            <FormField label="Дата" htmlFor="sr-date">
              <Input
                id="sr-date"
                type="date"
                value={performedAt}
                onChange={(e) => setPerformedAt(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Пробег, км" htmlFor="sr-mileage">
              <Input
                id="sr-mileage"
                type="number"
                min={0}
                value={mileageKm}
                onChange={(e) => setMileageKm(e.target.value)}
                placeholder={
                  vehicle.currentMileageKm != null ? String(vehicle.currentMileageKm) : '45000'
                }
              />
            </FormField>
          </div>

          <FormField label="Комментарий" htmlFor="sr-works" hint="необязательно">
            <textarea
              id="sr-works"
              className="textarea service-record-note-input"
              value={worksDone}
              onChange={(e) => setWorksDone(e.target.value)}
              rows={3}
              placeholder={
                category === 'oil_change' ? 'Масло 5W-40, фильтр масляный' : 'Что сделали'
              }
            />
          </FormField>

          <button
            type="button"
            className="service-record-details-toggle"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((v) => !v)}
          >
            {detailsOpen ? 'Скрыть доп. поля' : 'Название, ЗН, сумма'}
          </button>

          {detailsOpen ? (
            <div className="service-record-details">
              <FormField label="Название" htmlFor="sr-title">
                <Input
                  id="sr-title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setTitleCustomized(true);
                  }}
                />
              </FormField>
              <div className="service-record-form-grid">
                <FormField label="№ заказ-наряда" htmlFor="sr-wo">
                  <Input
                    id="sr-wo"
                    value={workOrderNumber}
                    onChange={(e) => setWorkOrderNumber(e.target.value)}
                    placeholder="ЗН-0042"
                  />
                </FormField>
                <FormField label="Сумма, ₽" htmlFor="sr-amount">
                  <Input
                    id="sr-amount"
                    type="number"
                    min={0}
                    value={amountRub}
                    onChange={(e) => setAmountRub(e.target.value)}
                    placeholder="8500"
                  />
                </FormField>
              </div>
            </div>
          ) : null}

          <div className="service-record-form-actions">
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Удалить запись?"
        text="Запись будет удалена из сервисной книжки."
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
