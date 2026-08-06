import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import {
  CATEGORY_TITLES,
  SERVICE_RECORD_CATEGORIES,
  buildOilMaintenancePlan,
  inferCategoryFromText,
} from '../../lib/maintenanceIntervals.js';
import {
  buildServiceHistoryPdfBuffer,
  buildServiceRecordJpegBuffer,
  buildServiceRecordPdfBuffer,
} from '../../lib/pdf/serviceRecordPdf.js';

function serializeRecord(row) {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    clientId: row.clientId,
    performedAt: row.performedAt.toISOString(),
    mileageKm: row.mileageKm,
    title: row.title,
    category: row.category,
    worksDone: row.worksDone,
    workOrderNumber: row.workOrderNumber,
    amountMinor: row.amountMinor,
    source: row.source,
    serviceRequestId: row.serviceRequestId,
    consultationFeedbackId: row.consultationFeedbackId,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getOwnedVehicle(vehicleId, clientId) {
  const vehicle = await prisma.clientVehicle.findFirst({
    where: { id: vehicleId, clientId },
  });
  if (!vehicle) throw new AppError(404, 'Автомобиль не найден', 'NOT_FOUND');
  return vehicle;
}

async function bumpVehicleMileage(vehicleId, mileageKm) {
  if (mileageKm == null || !Number.isFinite(Number(mileageKm))) return;
  const km = Math.round(Number(mileageKm));
  if (km < 0) return;
  const vehicle = await prisma.clientVehicle.findUnique({
    where: { id: vehicleId },
    select: { currentMileageKm: true },
  });
  if (!vehicle) return;
  if (vehicle.currentMileageKm != null && vehicle.currentMileageKm >= km) return;
  await prisma.clientVehicle.update({
    where: { id: vehicleId },
    data: { currentMileageKm: km },
  });
}

function normalizeCategory(category, title, worksDone) {
  const raw = String(category || '').trim();
  if (SERVICE_RECORD_CATEGORIES.includes(raw)) return raw;
  return inferCategoryFromText(`${title || ''} ${worksDone || ''}`);
}

function normalizeCreateInput(data) {
  const title = String(data.title || '').trim();
  const worksDone = String(data.worksDone || '').trim();
  if (!title && !worksDone) {
    throw new AppError(400, 'Укажите название или описание работ', 'VALIDATION_ERROR');
  }

  let performedAt = data.performedAt ? new Date(data.performedAt) : new Date();
  if (Number.isNaN(performedAt.getTime())) {
    throw new AppError(400, 'Некорректная дата работ', 'VALIDATION_ERROR');
  }

  let mileageKm = null;
  if (data.mileageKm != null && data.mileageKm !== '') {
    const parsed = Number(data.mileageKm);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2_000_000) {
      throw new AppError(400, 'Некорректный пробег', 'VALIDATION_ERROR');
    }
    mileageKm = Math.round(parsed);
  }

  let amountMinor = null;
  if (data.amountMinor != null && data.amountMinor !== '') {
    const parsed = Number(data.amountMinor);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new AppError(400, 'Некорректная сумма', 'VALIDATION_ERROR');
    }
    amountMinor = Math.round(parsed);
  }

  const category = normalizeCategory(data.category, title, worksDone);
  const resolvedTitle = title || CATEGORY_TITLES[category] || 'Выполненные работы';

  return {
    title: resolvedTitle.slice(0, 200),
    worksDone: worksDone || null,
    category,
    performedAt,
    mileageKm,
    amountMinor,
    workOrderNumber: String(data.workOrderNumber || '').trim().slice(0, 64) || null,
  };
}

export async function listServiceRecords(clientId, vehicleId) {
  await getOwnedVehicle(vehicleId, clientId);
  const rows = await prisma.vehicleServiceRecord.findMany({
    where: { vehicleId, clientId },
    orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map(serializeRecord);
}

export async function createServiceRecord(clientId, vehicleId, data, { createdById, source = 'client_manual' } = {}) {
  await getOwnedVehicle(vehicleId, clientId);
  const input = normalizeCreateInput(data);

  const row = await prisma.vehicleServiceRecord.create({
    data: {
      vehicleId,
      clientId,
      performedAt: input.performedAt,
      mileageKm: input.mileageKm,
      title: input.title,
      category: input.category,
      worksDone: input.worksDone,
      workOrderNumber: input.workOrderNumber,
      amountMinor: input.amountMinor,
      source,
      createdById: createdById || clientId,
    },
  });

  await bumpVehicleMileage(vehicleId, input.mileageKm);
  return serializeRecord(row);
}

export async function updateServiceRecord(clientId, recordId, data) {
  const existing = await prisma.vehicleServiceRecord.findFirst({
    where: { id: recordId, clientId },
  });
  if (!existing) throw new AppError(404, 'Запись не найдена', 'NOT_FOUND');
  if (existing.source !== 'client_manual') {
    throw new AppError(403, 'Можно редактировать только свои ручные записи', 'FORBIDDEN');
  }

  const input = normalizeCreateInput({
    title: data.title ?? existing.title,
    worksDone: data.worksDone !== undefined ? data.worksDone : existing.worksDone,
    category: data.category ?? existing.category,
    performedAt: data.performedAt ?? existing.performedAt,
    mileageKm: data.mileageKm !== undefined ? data.mileageKm : existing.mileageKm,
    amountMinor: data.amountMinor !== undefined ? data.amountMinor : existing.amountMinor,
    workOrderNumber:
      data.workOrderNumber !== undefined ? data.workOrderNumber : existing.workOrderNumber,
  });

  const row = await prisma.vehicleServiceRecord.update({
    where: { id: recordId },
    data: {
      performedAt: input.performedAt,
      mileageKm: input.mileageKm,
      title: input.title,
      category: input.category,
      worksDone: input.worksDone,
      workOrderNumber: input.workOrderNumber,
      amountMinor: input.amountMinor,
    },
  });

  await bumpVehicleMileage(existing.vehicleId, input.mileageKm);
  return serializeRecord(row);
}

export async function deleteServiceRecord(clientId, recordId) {
  const existing = await prisma.vehicleServiceRecord.findFirst({
    where: { id: recordId, clientId },
  });
  if (!existing) throw new AppError(404, 'Запись не найдена', 'NOT_FOUND');
  if (existing.source !== 'client_manual') {
    throw new AppError(403, 'Можно удалять только свои ручные записи', 'FORBIDDEN');
  }
  await prisma.vehicleServiceRecord.delete({ where: { id: recordId } });
}

export async function getMaintenancePlan(clientId, vehicleId) {
  const vehicle = await getOwnedVehicle(vehicleId, clientId);
  const records = await prisma.vehicleServiceRecord.findMany({
    where: { vehicleId, clientId },
    orderBy: [{ performedAt: 'desc' }],
    select: {
      id: true,
      performedAt: true,
      mileageKm: true,
      category: true,
      title: true,
      worksDone: true,
    },
  });

  const plan = buildOilMaintenancePlan(records, {
    currentMileageKm: vehicle.currentMileageKm,
  });

  return {
    vehicleId: vehicle.id,
    currentMileageKm: vehicle.currentMileageKm,
    ...plan,
  };
}

export async function getMaintenancePlanSummaryForClient(clientId) {
  const vehicles = await prisma.clientVehicle.findMany({
    where: { clientId },
    orderBy: [{ updatedAt: 'desc' }],
  });
  const results = [];
  for (const vehicle of vehicles) {
    const records = await prisma.vehicleServiceRecord.findMany({
      where: { vehicleId: vehicle.id, clientId },
      orderBy: [{ performedAt: 'desc' }],
      select: {
        performedAt: true,
        mileageKm: true,
        category: true,
        title: true,
        worksDone: true,
      },
    });
    const plan = buildOilMaintenancePlan(records, {
      currentMileageKm: vehicle.currentMileageKm,
    });
    if (plan.status === 'soon' || plan.status === 'overdue') {
      results.push({
        vehicleId: vehicle.id,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        currentMileageKm: vehicle.currentMileageKm,
        ...plan,
      });
    }
  }
  return results;
}

async function loadRecordForClient(clientId, recordId) {
  const row = await prisma.vehicleServiceRecord.findFirst({
    where: { id: recordId, clientId },
    include: { vehicle: true },
  });
  if (!row) throw new AppError(404, 'Запись не найдена', 'NOT_FOUND');
  return row;
}

export async function exportRecordPdf(clientId, recordId) {
  const row = await loadRecordForClient(clientId, recordId);
  return buildServiceRecordPdfBuffer({ record: row, vehicle: row.vehicle });
}

export async function exportRecordJpeg(clientId, recordId) {
  const row = await loadRecordForClient(clientId, recordId);
  return buildServiceRecordJpegBuffer({ record: row, vehicle: row.vehicle });
}

export async function exportHistoryPdf(clientId, vehicleId) {
  const vehicle = await getOwnedVehicle(vehicleId, clientId);
  const records = await prisma.vehicleServiceRecord.findMany({
    where: { vehicleId, clientId },
    orderBy: [{ performedAt: 'desc' }],
  });
  return buildServiceHistoryPdfBuffer({ records, vehicle });
}

/**
 * Создать/обновить запись из feedback менеджера.
 */
export async function upsertFromManagerFeedback({
  feedbackId,
  managerId,
  serviceRequestId,
  vehicleId,
  clientId,
  performedAt,
  mileageKm,
  worksDone,
  workOrderNumber,
  amountMinor,
  category,
  title,
}) {
  if (!vehicleId || !clientId) return null;

  const resolvedCategory = normalizeCategory(category, title, worksDone);
  const resolvedTitle =
    String(title || '').trim() ||
    CATEGORY_TITLES[resolvedCategory] ||
    String(worksDone || '').trim().slice(0, 200) ||
    'Выполненные работы';

  let date = performedAt ? new Date(performedAt) : new Date();
  if (Number.isNaN(date.getTime())) date = new Date();

  let km = null;
  if (mileageKm != null && mileageKm !== '') {
    const parsed = Number(mileageKm);
    if (Number.isFinite(parsed) && parsed >= 0) km = Math.round(parsed);
  }

  const existing = await prisma.vehicleServiceRecord.findFirst({
    where: { consultationFeedbackId: feedbackId },
  });

  const data = {
    vehicleId,
    clientId,
    performedAt: date,
    mileageKm: km,
    title: resolvedTitle.slice(0, 200),
    category: resolvedCategory,
    worksDone: String(worksDone || '').trim() || null,
    workOrderNumber: String(workOrderNumber || '').trim().slice(0, 64) || null,
    amountMinor: amountMinor != null && Number.isFinite(Number(amountMinor)) ? Math.round(Number(amountMinor)) : null,
    source: 'manager_feedback',
    serviceRequestId: serviceRequestId || null,
    consultationFeedbackId: feedbackId,
    createdById: managerId,
  };

  const row = existing
    ? await prisma.vehicleServiceRecord.update({ where: { id: existing.id }, data })
    : await prisma.vehicleServiceRecord.create({ data });

  await bumpVehicleMileage(vehicleId, km);
  return serializeRecord(row);
}

export async function findOilHistoryForLookup({ clientId, vehicleId }) {
  if (!clientId) return null;

  let vehicle = null;
  if (vehicleId) {
    vehicle = await prisma.clientVehicle.findFirst({
      where: { id: vehicleId, clientId },
    });
  }
  if (!vehicle) {
    const vehicles = await prisma.clientVehicle.findMany({
      where: { clientId },
      orderBy: [{ updatedAt: 'desc' }],
      take: 1,
    });
    vehicle = vehicles[0] || null;
  }
  if (!vehicle) return { vehicle: null, plan: null };

  const records = await prisma.vehicleServiceRecord.findMany({
    where: { vehicleId: vehicle.id, clientId },
    orderBy: [{ performedAt: 'desc' }],
  });
  const plan = buildOilMaintenancePlan(records, {
    currentMileageKm: vehicle.currentMileageKm,
  });

  return {
    vehicle: {
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      currentMileageKm: vehicle.currentMileageKm,
    },
    plan,
    records: records.map(serializeRecord),
  };
}
