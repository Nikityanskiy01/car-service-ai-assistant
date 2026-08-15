import {
  ArrowLeft,
  CalendarPlus,
  ChevronDown,
  Download,
  Droplets,
  FileImage,
  Gauge,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Wrench,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { downloadApiFile } from '../../../api/client';
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
import { FormField } from '../../../components/forms/FormField';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Input } from '../../../components/ui/Input';
import { Loader } from '../../../components/ui/Loader';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { prefillOilChangeBookingFromPlan } from '../../../features/consultations/bookingPrefill';
import { usePageMeta } from '../../../hooks/usePageMeta';
import { bookingPath } from '../../../lib/bookingPath';

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

function oilTitle(status?: string) {
  if (status === 'overdue') return 'Пора менять масло';
  if (status === 'soon') return 'Скоро нужна замена';
  if (status === 'ok') return 'Масло в норме';
  return 'План замены масла';
}

function oilLead(status?: string, remainCopy?: string, intervalKm?: number, intervalMonths?: number) {
  if (status === 'overdue') {
    return remainCopy
      ? `Пробег и срок вышли: ${remainCopy}. Запишитесь — сервис подберёт время.`
      : 'Интервал замены вышел. Запишитесь на удобное время.';
  }
  if (status === 'soon') {
    return remainCopy
      ? `До замены осталось: ${remainCopy}. Лучше записаться заранее.`
      : 'Скоро подойдёт срок замены масла.';
  }
  if (status === 'ok') {
    return remainCopy
      ? `Запас: ${remainCopy}. Можно спокойно ездить.`
      : 'По текущим данным масло в порядке.';
  }
  return `Укажите прошлую замену — рассчитаем срок по регламенту ${intervalKm ?? 7500} км / ${intervalMonths ?? 6} мес.`;
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

function recordsCountLabel(count: number) {
  if (!count) return 'Пока пусто';
  if (count === 1) return '1 запись';
  if (count < 5) return `${count} записи`;
  return `${count} записей`;
}

function oilRemainCopy(plan: MaintenancePlan | null) {
  const kmLeft = plan?.plan?.kmLeft;
  const daysLeft = plan?.plan?.daysLeft;
  const parts: string[] = [];

  if (kmLeft != null) {
    if (kmLeft < 0) parts.push(`+${Math.abs(kmLeft).toLocaleString('ru-RU')} км сверх нормы`);
    else parts.push(`${kmLeft.toLocaleString('ru-RU')} км`);
  }
  if (daysLeft != null) {
    if (daysLeft < 0) parts.push(`${Math.abs(daysLeft)} дн. просрочки`);
    else parts.push(`${daysLeft} дн.`);
  }
  return parts.join(' · ');
}

function oilProgress(plan: MaintenancePlan | null) {
  if (!plan?.plan || !plan.hasHistory) return null;
  const interval = plan.intervalKm || 7500;
  const kmLeft = plan.plan.kmLeft;
  if (kmLeft == null) return null;
  const used = interval - kmLeft;
  const ratio = Math.min(1, Math.max(0, used / interval));
  return { ratio, overdue: kmLeft < 0 };
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
  const [mileageEdit, setMileageEdit] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
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
      setMileageEdit(false);
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
      setMetaOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить данные');
    } finally {
      setSavingMeta(false);
    }
  }

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
    navigate(bookingPath(vehicle.id));
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
  const oilUrgent = oilStatus === 'overdue' || oilStatus === 'soon';
  const remainCopy = oilRemainCopy(plan);
  const progress = oilProgress(plan);
  const mileageDisplay =
    vehicle.currentMileageKm != null
      ? `${vehicle.currentMileageKm.toLocaleString('ru-RU')} км`
      : 'не указан';
  const lastServiceLabel = vehicle.lastServiceAt
    ? new Date(vehicle.lastServiceAt).toLocaleDateString('ru-RU')
    : null;
  const extraDetailsHint = [
    titleCustomized ? title.trim() || null : null,
    workOrderNumber.trim() || null,
    amountRub.trim() && Number.isFinite(Number(amountRub))
      ? `${Number(amountRub).toLocaleString('ru-RU')} ₽`
      : null,
  ]
    .filter(Boolean)
    .join(' · ') || 'Название, заказ-наряд и сумма — по желанию';
  const progressPct = progress ? Math.round(progress.ratio * 100) : 0;

  return (
    <div className="service-book stack">
      <div className="service-book-top">
        <Link to="/dashboard/client/vehicles" className="service-book-back">
          <ArrowLeft size={16} aria-hidden />
          К гаражу
        </Link>
        <button
          type="button"
          className="service-book-edit-link"
          onClick={() => setMetaOpen(true)}
        >
          <Pencil size={14} aria-hidden />
          Данные
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <section className="service-book-identity" aria-label="Автомобиль">
        <div className="service-book-identity-media">
          <VehiclePhotoPicker
            vehicle={vehicle}
            size="lg"
            onUpdated={(updated) => {
              setVehicle(updated);
            }}
          />
        </div>

        <div className="service-book-identity-body">
          <div className="service-book-identity-heading">
            <h1>{titleText}</h1>
            <div className="service-book-identity-meta">
              {vehicle.year ? <span>{vehicle.year} г.</span> : null}
              {vehicle.licensePlate ? (
                <span className="garage-plate is-compact">{vehicle.licensePlate}</span>
              ) : null}
              {vehicle.color ? <span>{vehicle.color}</span> : null}
              {vehicle.vin ? <span className="service-book-vin">VIN ···{vehicle.vin.slice(-6)}</span> : null}
            </div>
          </div>

          <div className="service-book-facts" aria-label="Ключевые данные">
            <div className="service-book-fact">
              <span className="service-book-fact-icon" aria-hidden>
                <Gauge size={16} />
              </span>
              <div className="service-book-fact-copy">
                <span className="service-book-fact-label">Пробег</span>
                {mileageEdit ? (
                  <form className="service-book-mileage-edit" onSubmit={(e) => void handleSaveMileage(e)}>
                    <Input
                      id="vehicle-mileage"
                      type="number"
                      min={0}
                      value={mileageDraft}
                      onChange={(e) => setMileageDraft(e.target.value)}
                      placeholder="45200"
                      autoFocus
                      aria-label="Текущий пробег, км"
                    />
                    <Button type="submit" disabled={savingMileage}>
                      {savingMileage ? '…' : 'OK'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setMileageDraft(
                          vehicle.currentMileageKm != null ? String(vehicle.currentMileageKm) : '',
                        );
                        setMileageEdit(false);
                      }}
                    >
                      Отмена
                    </Button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="service-book-fact-value is-action"
                    onClick={() => setMileageEdit(true)}
                  >
                    <strong>{mileageDisplay}</strong>
                    <span>изменить</span>
                  </button>
                )}
              </div>
            </div>

            <div className="service-book-fact">
              <span className="service-book-fact-icon" aria-hidden>
                <Wrench size={16} />
              </span>
              <div className="service-book-fact-copy">
                <span className="service-book-fact-label">Последний сервис</span>
                <strong className="service-book-fact-value">
                  {lastServiceLabel || 'ещё не было'}
                </strong>
                {vehicle.lastServiceTitle ? (
                  <span className="service-book-fact-sub">{vehicle.lastServiceTitle}</span>
                ) : null}
              </div>
            </div>

            <div className={`service-book-fact is-oil is-${oilStatus}`}>
              <span className="service-book-fact-icon" aria-hidden>
                <Droplets size={16} />
              </span>
              <div className="service-book-fact-copy">
                <span className="service-book-fact-label">Масло</span>
                <strong className="service-book-fact-value">{statusLabel(oilStatus)}</strong>
                {remainCopy ? <span className="service-book-fact-sub">{remainCopy}</span> : null}
              </div>
            </div>
          </div>

          <div className="service-book-quick-actions">
            {oilUrgent ? (
              <Button type="button" onClick={bookOilChange}>
                <CalendarPlus size={16} aria-hidden />
                Записаться на замену
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={bookOilChange}>
                <CalendarPlus size={16} aria-hidden />
                Записаться
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={() => openAddModal()}>
              <Plus size={16} aria-hidden />
              Добавить работу
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                void downloadApiFile(
                  `/api/vehicles/${vehicle.id}/service-history/export.pdf`,
                  `service-history-${vehicle.id.slice(0, 8)}.pdf`,
                )
              }
            >
              <Download size={16} aria-hidden />
              PDF книжки
            </Button>
          </div>
        </div>
      </section>

      <section className={`service-book-oil is-${oilStatus}`} aria-label="План замены масла">
        <div className="service-book-oil-head">
          <span className="service-book-oil-icon" aria-hidden>
            <Droplets size={22} strokeWidth={2} />
          </span>
          <div className="service-book-oil-copy">
            <p className="service-book-oil-kicker">Замена масла</p>
            <h2 className="service-book-oil-title">{oilTitle(oilStatus)}</h2>
            <p className="service-book-oil-remain">
              {oilLead(oilStatus, remainCopy, plan?.intervalKm, plan?.intervalMonths)}
            </p>
          </div>
          <span className="service-book-oil-badge">{statusLabel(oilStatus)}</span>
        </div>

        {plan?.hasHistory && plan.plan ? (
          <>
            {progress ? (
              <div
                className={`service-book-oil-progress${progress.overdue ? ' is-overdue' : ''}`}
                role="meter"
                aria-label="Интервал до замены масла"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPct}
              >
                <div className="service-book-oil-progress-meta">
                  <span>Интервал {plan.intervalKm?.toLocaleString('ru-RU') ?? '7 500'} км</span>
                  <span>{progress.overdue ? 'Просрочено' : `${progressPct}% интервала`}</span>
                </div>
                <div className="service-book-oil-progress-track">
                  <div
                    className="service-book-oil-progress-fill"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            ) : null}

            <div className="service-book-oil-grid">
              <div>
                <span>Последняя</span>
                <strong>
                  {plan.lastRecord?.performedAt
                    ? new Date(plan.lastRecord.performedAt).toLocaleDateString('ru-RU')
                    : '—'}
                </strong>
                <em>
                  {plan.lastRecord?.mileageKm != null
                    ? `${plan.lastRecord.mileageKm.toLocaleString('ru-RU')} км`
                    : 'пробег не указан'}
                </em>
              </div>
              <div>
                <span>Следующая</span>
                <strong>
                  {plan.plan.nextDueAt
                    ? new Date(plan.plan.nextDueAt).toLocaleDateString('ru-RU')
                    : '—'}
                </strong>
                <em>
                  {plan.plan.nextDueMileage != null
                    ? `${plan.plan.nextDueMileage.toLocaleString('ru-RU')} км`
                    : 'по дате'}
                </em>
              </div>
            </div>

            {oilUrgent ? (
              <div className="service-book-oil-actions">
                <Button type="button" onClick={bookOilChange}>
                  <CalendarPlus size={16} aria-hidden />
                  Записаться на замену
                </Button>
                <Button type="button" variant="secondary" onClick={() => openAddModal('oil_change')}>
                  Уже менял — записать
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="service-book-oil-empty">
            <p>Нет записей о замене масла. Укажите прошлую — рассчитаем следующий срок.</p>
            <Button type="button" onClick={() => openAddModal('oil_change')}>
              Указать замену масла
            </Button>
          </div>
        )}
      </section>

      <section className="service-book-history" aria-label="История работ">
        <header className="service-book-history-header">
          <div>
            <h2>История работ</h2>
            <p className="muted">{recordsCountLabel(records.length)}</p>
          </div>
          <Button type="button" onClick={() => openAddModal()}>
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
          <ul className="service-book-records">
            {records.map((record, index) => {
              const day = new Date(record.performedAt);
              const isFirst = index === 0;
              return (
                <li key={record.id} className={`service-book-record${isFirst ? ' is-latest' : ''}`}>
                  <div className="service-book-record-rail" aria-hidden>
                    <span className="service-book-record-dot" />
                  </div>
                  <div className="service-book-record-card">
                    <div className="service-book-record-top">
                      <div className="service-book-record-when">
                        <time dateTime={record.performedAt}>
                          {day.toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </time>
                        {record.mileageKm != null ? (
                          <span>{record.mileageKm.toLocaleString('ru-RU')} км</span>
                        ) : null}
                        <span className="service-book-record-cat">
                          {categoryLabel(String(record.category))}
                        </span>
                      </div>
                      <details className="service-book-record-more">
                        <summary aria-label="Ещё действия">
                          <MoreHorizontal size={16} aria-hidden />
                        </summary>
                        <div className="service-book-record-more-menu">
                          <button
                            type="button"
                            onClick={() =>
                              void downloadApiFile(
                                `/api/service-records/${record.id}/export.pdf`,
                                `service-record-${record.id.slice(0, 8)}.pdf`,
                              )
                            }
                          >
                            <Download size={14} aria-hidden />
                            PDF
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void downloadApiFile(
                                `/api/service-records/${record.id}/export.jpg`,
                                `service-record-${record.id.slice(0, 8)}.jpg`,
                              )
                            }
                          >
                            <FileImage size={14} aria-hidden />
                            JPEG
                          </button>
                          {record.source === 'client_manual' ? (
                            <button type="button" onClick={() => setDeleteId(record.id)}>
                              <Trash2 size={14} aria-hidden />
                              Удалить
                            </button>
                          ) : null}
                        </div>
                      </details>
                    </div>

                    <div className="service-book-record-main">
                      <span className="service-book-record-icon" aria-hidden>
                        {record.category === 'oil_change' ? (
                          <Droplets size={16} />
                        ) : (
                          <Wrench size={16} />
                        )}
                      </span>
                      <div className="service-book-record-titles">
                        <strong>{record.title}</strong>
                        <div className="service-book-record-meta">
                          {record.workOrderNumber ? <span>ЗН {record.workOrderNumber}</span> : null}
                          {formatMoney(record.amountMinor) ? (
                            <span>{formatMoney(record.amountMinor)}</span>
                          ) : null}
                          <span>
                            {record.source === 'manager_feedback' ? 'Сервис' : 'Вручную'}
                          </span>
                        </div>
                        {record.worksDone ? (
                          <p className="service-book-record-note">{record.worksDone}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal open={metaOpen} onClose={() => setMetaOpen(false)} title="Данные автомобиля">
        <form className="service-book-meta-form" onSubmit={(e) => void handleSaveMeta(e)}>
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
          <div className="service-book-meta-form-actions">
            <Button type="button" variant="secondary" onClick={() => setMetaOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={savingMeta}>
              {savingMeta ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </div>
        </form>
      </Modal>

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
            className={`service-record-details-toggle${detailsOpen ? ' is-open' : ''}`}
            aria-expanded={detailsOpen}
            aria-controls="service-record-extra-fields"
            onClick={() => setDetailsOpen((v) => !v)}
          >
            <span className="service-record-details-toggle-copy">
              <strong>Дополнительно</strong>
              <small>{extraDetailsHint}</small>
            </span>
            <ChevronDown size={18} className="service-record-details-toggle-chevron" aria-hidden />
          </button>

          {detailsOpen ? (
            <div className="service-record-details" id="service-record-extra-fields">
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
