import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { prefillOilChangeBookingFromPlan } from '../../../features/consultations/bookingPrefill';
import { usePageMeta } from '../../../hooks/usePageMeta';
import { bookingPath } from '../../../lib/bookingPath';
import { categoryTitle, oilProgress, oilRemainCopy } from './vehicleDetailLabels';

export function useClientVehicleDetail() {
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

  const titleText = vehicle ? formatVehicleTitle(vehicle) : '';
  const oilStatus = plan?.status || 'unknown';
  const oilUrgent = oilStatus === 'overdue' || oilStatus === 'soon';
  const remainCopy = oilRemainCopy(plan);
  const progress = oilProgress(plan);
  const mileageDisplay =
    vehicle?.currentMileageKm != null
      ? `${vehicle.currentMileageKm.toLocaleString('ru-RU')} км`
      : 'не указан';
  const lastServiceLabel = vehicle?.lastServiceAt
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

  return {
    vehicle,
    setVehicle,
    records,
    plan,
    loading,
    error,
    addOpen,
    setAddOpen,
    saving,
    deleteId,
    setDeleteId,
    mileageDraft,
    setMileageDraft,
    savingMileage,
    mileageEdit,
    setMileageEdit,
    metaOpen,
    setMetaOpen,
    plateDraft,
    setPlateDraft,
    colorDraft,
    setColorDraft,
    vinDraft,
    setVinDraft,
    savingMeta,
    title,
    setTitle,
    category,
    setTitleCustomized,
    performedAt,
    setPerformedAt,
    mileageKm,
    setMileageKm,
    worksDone,
    setWorksDone,
    workOrderNumber,
    setWorkOrderNumber,
    amountRub,
    setAmountRub,
    detailsOpen,
    setDetailsOpen,
    handleSaveMileage,
    handleSaveMeta,
    openAddModal,
    selectCategory,
    handleAdd,
    handleDelete,
    bookOilChange,
    titleText,
    oilStatus,
    oilUrgent,
    remainCopy,
    progress,
    mileageDisplay,
    lastServiceLabel,
    extraDetailsHint,
    progressPct,
  };
}

export type VehicleDetailState = ReturnType<typeof useClientVehicleDetail>;
export type LoadedVehicleDetail = Omit<VehicleDetailState, 'vehicle'> & {
  vehicle: NonNullable<VehicleDetailState['vehicle']>;
};
