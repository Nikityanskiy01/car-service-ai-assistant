import type { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import {
  deleteVehiclePhotoFile,
  readVehiclePhotoFile,
  saveVehiclePhotoFile,
  validateVehiclePhotoInput,
  vehiclePhotoMimeFromKey,
} from '../../lib/vehiclePhotoStorage.js';
import {
  serializeVehicle,
  getLatestServiceByVehicle,
  getVehicleCaseCounts,
  findVehicleByFingerprint,
  excludeVehicleFingerprint,
  clearVehicleExclusion,
  vehicleFingerprint,
} from './vehicles.helpers.js';
import { syncVehiclesFromHistoryThrottled } from './vehicles.sync.js';
import type { VehiclePhotoInput, VehicleWriteInput } from './vehicles.types.js';

export {
  findOrCreateVehicleForClient,
  linkSessionToVehicle,
  syncVehiclesFromHistory,
} from './vehicles.sync.js';

export async function listVehicles(clientId: string) {
  await syncVehiclesFromHistoryThrottled(clientId);

  const vehicles = await prisma.clientVehicle.findMany({
    where: { clientId },
    orderBy: [{ updatedAt: 'desc' }],
  });
  const vehicleIds = vehicles.map((vehicle) => vehicle.id);
  const [counts, latestService] = await Promise.all([
    getVehicleCaseCounts(clientId, vehicleIds),
    getLatestServiceByVehicle(vehicleIds),
  ]);

  return vehicles.map((vehicle) => ({
    ...serializeVehicle(vehicle),
    activeCasesCount: counts[vehicle.id]?.active ?? 0,
    totalCasesCount: counts[vehicle.id]?.total ?? 0,
    lastServiceAt: latestService[vehicle.id]?.lastServiceAt ?? null,
    lastServiceTitle: latestService[vehicle.id]?.lastServiceTitle ?? null,
    lastServiceCategory: latestService[vehicle.id]?.lastServiceCategory ?? null,
  }));
}

export async function getVehicle(clientId: string, vehicleId: string) {
  const vehicle = await prisma.clientVehicle.findFirst({
    where: { id: vehicleId, clientId },
  });
  if (!vehicle) throw new AppError(404, 'Автомобиль не найден', 'NOT_FOUND');
  const [counts, latestService] = await Promise.all([
    getVehicleCaseCounts(clientId, [vehicleId]),
    getLatestServiceByVehicle([vehicleId]),
  ]);
  return {
    ...serializeVehicle(vehicle),
    activeCasesCount: counts[vehicleId]?.active ?? 0,
    totalCasesCount: counts[vehicleId]?.total ?? 0,
    lastServiceAt: latestService[vehicleId]?.lastServiceAt ?? null,
    lastServiceTitle: latestService[vehicleId]?.lastServiceTitle ?? null,
    lastServiceCategory: latestService[vehicleId]?.lastServiceCategory ?? null,
  };
}

export async function createVehicle(clientId: string, data: VehicleWriteInput) {
  const make = String(data.make || '').trim();
  const model = String(data.model || '').trim();
  if (!make || !model) {
    throw new AppError(400, 'Укажите марку и модель', 'VALIDATION_ERROR');
  }

  const year = data.year != null && data.year !== '' ? Number(data.year) : null;
  if (year != null && (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1)) {
    throw new AppError(400, 'Некорректный год выпуска', 'VALIDATION_ERROR');
  }

  const duplicate = await findVehicleByFingerprint(clientId, make, model, year);
  if (duplicate) {
    throw new AppError(409, 'Такой автомобиль уже есть в гараже', 'CONFLICT');
  }

  const vehicle = await prisma.clientVehicle.create({
    data: {
      clientId,
      make,
      model,
      year,
      vin: data.vin?.trim() || null,
      notes: data.notes?.trim() || null,
      licensePlate: data.licensePlate?.trim()?.toUpperCase() || null,
      color: data.color?.trim() || null,
      source: 'manual',
    },
  });

  await clearVehicleExclusion(clientId, make, model, year);

  return serializeVehicle(vehicle);
}

export async function updateVehicle(clientId: string, vehicleId: string, data: VehicleWriteInput) {
  const vehicle = await prisma.clientVehicle.findFirst({
    where: { id: vehicleId, clientId },
  });
  if (!vehicle) throw new AppError(404, 'Автомобиль не найден', 'NOT_FOUND');

  const patch: Prisma.ClientVehicleUpdateInput = {};
  if (data.currentMileageKm !== undefined) {
    if (data.currentMileageKm == null || data.currentMileageKm === '') {
      patch.currentMileageKm = null;
    } else {
      const km = Number(data.currentMileageKm);
      if (!Number.isFinite(km) || km < 0 || km > 2_000_000) {
        throw new AppError(400, 'Некорректный пробег', 'VALIDATION_ERROR');
      }
      patch.currentMileageKm = Math.round(km);
    }
  }
  if (data.notes !== undefined) {
    patch.notes = data.notes == null ? null : String(data.notes).trim().slice(0, 500) || null;
  }
  if (data.vin !== undefined) {
    patch.vin = data.vin == null ? null : String(data.vin).trim().slice(0, 32) || null;
  }
  if (data.licensePlate !== undefined) {
    patch.licensePlate =
      data.licensePlate == null
        ? null
        : String(data.licensePlate).trim().toUpperCase().slice(0, 16) || null;
  }
  if (data.color !== undefined) {
    patch.color = data.color == null ? null : String(data.color).trim().slice(0, 40) || null;
  }

  if (!Object.keys(patch).length) {
    return getVehicle(clientId, vehicleId);
  }

  await prisma.clientVehicle.update({
    where: { id: vehicleId },
    data: patch,
  });
  return getVehicle(clientId, vehicleId);
}

export async function uploadVehiclePhoto(clientId: string, vehicleId: string, { mimeType, contentBase64 }: VehiclePhotoInput) {
  const vehicle = await prisma.clientVehicle.findFirst({
    where: { id: vehicleId, clientId },
    select: { id: true, photoUrl: true },
  });
  if (!vehicle) throw new AppError(404, 'Автомобиль не найден', 'NOT_FOUND');

  const parsed = validateVehiclePhotoInput({ mimeType, contentBase64 });
  const storageKey = await saveVehiclePhotoFile(parsed.buffer, parsed.ext);

  try {
    await prisma.clientVehicle.update({
      where: { id: vehicleId },
      data: { photoUrl: storageKey },
    });
    if (vehicle.photoUrl && vehicle.photoUrl !== storageKey) {
      await deleteVehiclePhotoFile(vehicle.photoUrl);
    }
  } catch (err) {
    await deleteVehiclePhotoFile(storageKey);
    throw err;
  }

  return getVehicle(clientId, vehicleId);
}

export async function removeVehiclePhoto(clientId: string, vehicleId: string) {
  const vehicle = await prisma.clientVehicle.findFirst({
    where: { id: vehicleId, clientId },
    select: { id: true, photoUrl: true },
  });
  if (!vehicle) throw new AppError(404, 'Автомобиль не найден', 'NOT_FOUND');

  if (vehicle.photoUrl) {
    await deleteVehiclePhotoFile(vehicle.photoUrl);
  }
  await prisma.clientVehicle.update({
    where: { id: vehicleId },
    data: { photoUrl: null },
  });
  return getVehicle(clientId, vehicleId);
}

export async function getVehiclePhoto(clientId: string, vehicleId: string) {
  const vehicle = await prisma.clientVehicle.findFirst({
    where: { id: vehicleId, clientId },
    select: { photoUrl: true },
  });
  if (!vehicle?.photoUrl) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  const buffer = await readVehiclePhotoFile(vehicle.photoUrl);
  return { buffer, mimeType: vehiclePhotoMimeFromKey(vehicle.photoUrl) };
}

export async function deleteVehicle(clientId: string, vehicleId: string) {
  const vehicle = await prisma.clientVehicle.findFirst({
    where: { id: vehicleId, clientId },
  });
  if (!vehicle) throw new AppError(404, 'Автомобиль не найден', 'NOT_FOUND');

  await excludeVehicleFingerprint(clientId, vehicle.make, vehicle.model, vehicle.year);

  const fingerprint = vehicleFingerprint(vehicle.make, vehicle.model, vehicle.year);
  const siblings = await prisma.clientVehicle.findMany({
    where: { clientId },
    select: { id: true, make: true, model: true, year: true, photoUrl: true },
  });
  const matched = siblings.filter(
    (row) => vehicleFingerprint(row.make, row.model, row.year) === fingerprint,
  );
  const vehicleIds = matched.map((row) => row.id);

  await prisma.$transaction([
    prisma.consultationSession.updateMany({
      where: { vehicleId: { in: vehicleIds } },
      data: { vehicleId: null },
    }),
    prisma.serviceRequest.updateMany({
      where: { vehicleId: { in: vehicleIds } },
      data: { vehicleId: null },
    }),
    prisma.serviceBooking.updateMany({
      where: { vehicleId: { in: vehicleIds } },
      data: { vehicleId: null },
    }),
    prisma.clientVehicle.deleteMany({ where: { id: { in: vehicleIds }, clientId } }),
  ]);

  await Promise.all(matched.map((row) => deleteVehiclePhotoFile(row.photoUrl)));
}

export async function listVehiclesForDossier(clientId: string) {
  await syncVehiclesFromHistoryThrottled(clientId);
  const vehicles = await prisma.clientVehicle.findMany({
    where: { clientId },
    orderBy: [{ updatedAt: 'desc' }],
  });
  const latestService = await getLatestServiceByVehicle(vehicles.map((vehicle) => vehicle.id));
  return vehicles.map((vehicle) => ({
    ...serializeVehicle(vehicle),
    lastServiceAt: latestService[vehicle.id]?.lastServiceAt ?? null,
    lastServiceTitle: latestService[vehicle.id]?.lastServiceTitle ?? null,
    lastServiceCategory: latestService[vehicle.id]?.lastServiceCategory ?? null,
  }));
}
