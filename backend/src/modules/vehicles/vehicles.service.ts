import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import {
  deleteVehiclePhotoFile,
  readVehiclePhotoFile,
  saveVehiclePhotoFile,
  validateVehiclePhotoInput,
  vehiclePhotoMimeFromKey,
} from '../../lib/vehiclePhotoStorage.js';

function norm(value) {
  return String(value || '').trim().toLowerCase();
}

function vehicleFingerprint(make, model, year) {
  return `${norm(make)}|${norm(model)}|${year ?? ''}`;
}

function publicPhotoUrl(vehicleId, photoUrl) {
  if (!photoUrl) return null;
  return `/api/vehicles/${vehicleId}/photo`;
}

function serializeVehicle(vehicle) {
  return {
    id: vehicle.id,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    vin: vehicle.vin,
    notes: vehicle.notes,
    source: vehicle.source,
    currentMileageKm: vehicle.currentMileageKm ?? null,
    photoUrl: publicPhotoUrl(vehicle.id, vehicle.photoUrl),
    licensePlate: vehicle.licensePlate ?? null,
    color: vehicle.color ?? null,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  };
}

async function getLatestServiceByVehicle(vehicleIds) {
  if (!vehicleIds.length) return {};
  const rows = await prisma.vehicleServiceRecord.findMany({
    where: { vehicleId: { in: vehicleIds } },
    orderBy: [{ performedAt: 'desc' }],
    select: { vehicleId: true, performedAt: true, title: true, category: true },
  });
  const latest: any = {};
  for (const row of rows) {
    if (latest[row.vehicleId]) continue;
    latest[row.vehicleId] = {
      lastServiceAt: row.performedAt.toISOString(),
      lastServiceTitle: row.title,
      lastServiceCategory: row.category,
    };
  }
  return latest;
}

async function getVehicleCaseCounts(clientId, vehicleIds) {
  if (!vehicleIds.length) return {};

  const [sessions, requests] = await Promise.all([
    prisma.consultationSession.findMany({
      where: { clientId, vehicleId: { in: vehicleIds }, serviceRequest: null },
      select: { vehicleId: true },
    }),
    prisma.serviceRequest.findMany({
      where: { clientId, vehicleId: { in: vehicleIds } },
      select: { vehicleId: true, status: true },
    }),
  ]);

  const counts = Object.fromEntries(vehicleIds.map((id) => [id, { active: 0, total: 0 }]));

  for (const session of sessions) {
    if (!session.vehicleId) continue;
    counts[session.vehicleId].total += 1;
    counts[session.vehicleId].active += 1;
  }

  for (const request of requests) {
    if (!request.vehicleId) continue;
    counts[request.vehicleId].total += 1;
    if (request.status !== 'COMPLETED' && request.status !== 'CANCELLED') {
      counts[request.vehicleId].active += 1;
    }
  }

  return counts;
}

async function findVehicleByFingerprint(clientId, make, model, year) {
  const vehicles = await prisma.clientVehicle.findMany({ where: { clientId } });
  const fingerprint = vehicleFingerprint(make, model, year);
  return vehicles.find((vehicle) => vehicleFingerprint(vehicle.make, vehicle.model, vehicle.year) === fingerprint) || null;
}

async function getExcludedFingerprints(clientId) {
  const rows = await prisma.clientVehicleExclusion.findMany({
    where: { clientId },
    select: { fingerprint: true },
  });
  return new Set(rows.map((row) => row.fingerprint));
}

async function excludeVehicleFingerprint(clientId, make, model, year) {
  const fingerprint = vehicleFingerprint(make, model, year);
  await prisma.clientVehicleExclusion.upsert({
    where: {
      clientId_fingerprint: {
        clientId,
        fingerprint,
      },
    },
    create: { clientId, fingerprint },
    update: {},
  });
}

async function clearVehicleExclusion(clientId, make, model, year) {
  const fingerprint = vehicleFingerprint(make, model, year);
  await prisma.clientVehicleExclusion.deleteMany({
    where: { clientId, fingerprint },
  });
}

function isFingerprintExcluded(excluded, make, model, year) {
  return excluded.has(vehicleFingerprint(make, model, year));
}

export async function findOrCreateVehicleForClient(clientId, { make, model, year }, source = 'imported') {
  const normalizedMake = String(make || '').trim();
  const normalizedModel = String(model || '').trim();
  if (!normalizedMake && !normalizedModel) return null;

  const excluded = await getExcludedFingerprints(clientId);
  if (isFingerprintExcluded(excluded, normalizedMake, normalizedModel, year ?? null)) {
    return null;
  }

  const existing = await findVehicleByFingerprint(clientId, normalizedMake, normalizedModel, year ?? null);
  if (existing) return existing;

  return prisma.clientVehicle.create({
    data: {
      clientId,
      make: normalizedMake || 'Неизвестная марка',
      model: normalizedModel,
      year: year ?? null,
      source,
    },
  });
}

export async function linkSessionToVehicle(sessionId, clientId, { make, model, year }: any) {
  if (!clientId) return null;

  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    select: { vehicleId: true },
  });
  if (!session || session.vehicleId) return session?.vehicleId ?? null;

  const vehicle = await findOrCreateVehicleForClient(clientId, { make, model, year });
  if (!vehicle) return null;

  await prisma.consultationSession.update({
    where: { id: sessionId },
    data: { vehicleId: vehicle.id },
  });

  return vehicle.id;
}

export async function syncVehiclesFromHistory(clientId) {
  const [sessions, orphanRequests, existing, excluded] = await Promise.all([
    prisma.consultationSession.findMany({
      where: { clientId },
      include: { extracted: true, serviceRequest: { select: { id: true, vehicleId: true } } },
    }),
    prisma.serviceRequest.findMany({
      where: { clientId, vehicleId: null },
      select: {
        id: true,
        snapshotMake: true,
        snapshotModel: true,
        consultationSessionId: true,
      },
    }),
    prisma.clientVehicle.findMany({ where: { clientId } }),
    getExcludedFingerprints(clientId),
  ]);

  const byFingerprint = new Map(
    existing.map((vehicle) => [vehicleFingerprint(vehicle.make, vehicle.model, vehicle.year), vehicle]),
  );

  for (const session of sessions) {
    const extracted = session.extracted;
    const make = extracted?.make?.trim();
    const model = extracted?.model?.trim();
    if (!make && !model) continue;

    const fingerprint = vehicleFingerprint(make, model, extracted?.year ?? null);
    if (isFingerprintExcluded(excluded, make, model, extracted?.year ?? null)) continue;

    let vehicle = byFingerprint.get(fingerprint);
    if (!vehicle) {
      vehicle = await prisma.clientVehicle.create({
        data: {
          clientId,
          make: make || 'Неизвестная марка',
          model: model || '',
          year: extracted?.year ?? null,
          source: 'imported',
        },
      });
      byFingerprint.set(fingerprint, vehicle);
    }

    if (!session.vehicleId) {
      await prisma.consultationSession.update({
        where: { id: session.id },
        data: { vehicleId: vehicle.id },
      });
    }

    if (session.serviceRequest && !session.serviceRequest.vehicleId) {
      await prisma.serviceRequest.update({
        where: { id: session.serviceRequest.id },
        data: { vehicleId: vehicle.id },
      });
    }
  }

  for (const request of orphanRequests) {
    const make = request.snapshotMake?.trim();
    const model = request.snapshotModel?.trim();
    if (!make && !model) continue;

    const fingerprint = vehicleFingerprint(make, model, null);
    if (isFingerprintExcluded(excluded, make, model, null)) continue;

    let vehicle = byFingerprint.get(fingerprint);
    if (!vehicle) {
      vehicle = await prisma.clientVehicle.create({
        data: {
          clientId,
          make: make || 'Неизвестная марка',
          model: model || '',
          source: 'imported',
        },
      });
      byFingerprint.set(fingerprint, vehicle);
    }

    await prisma.serviceRequest.update({
      where: { id: request.id },
      data: { vehicleId: vehicle.id },
    });
  }
}

/** Debounce history sync so garage list stays fast on repeated opens. */
const vehicleSyncAt = new Map();
const VEHICLE_SYNC_TTL_MS = 5 * 60 * 1000;

async function syncVehiclesFromHistoryThrottled(clientId) {
  const last = vehicleSyncAt.get(clientId) || 0;
  if (Date.now() - last < VEHICLE_SYNC_TTL_MS) return;
  vehicleSyncAt.set(clientId, Date.now());
  await syncVehiclesFromHistory(clientId);
}

export async function listVehicles(clientId) {
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

export async function getVehicle(clientId, vehicleId) {
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

export async function createVehicle(clientId, data) {
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

export async function updateVehicle(clientId, vehicleId, data) {
  const vehicle = await prisma.clientVehicle.findFirst({
    where: { id: vehicleId, clientId },
  });
  if (!vehicle) throw new AppError(404, 'Автомобиль не найден', 'NOT_FOUND');

  const patch: any = {};
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

export async function uploadVehiclePhoto(clientId, vehicleId, { mimeType, contentBase64 }: any) {
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

export async function removeVehiclePhoto(clientId, vehicleId) {
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

export async function getVehiclePhoto(clientId, vehicleId) {
  const vehicle = await prisma.clientVehicle.findFirst({
    where: { id: vehicleId, clientId },
    select: { photoUrl: true },
  });
  if (!vehicle?.photoUrl) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  const buffer = await readVehiclePhotoFile(vehicle.photoUrl);
  return { buffer, mimeType: vehiclePhotoMimeFromKey(vehicle.photoUrl) };
}

export async function deleteVehicle(clientId, vehicleId) {
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

export async function listVehiclesForDossier(clientId) {
  await syncVehiclesFromHistoryThrottled(clientId);
  const vehicles = await prisma.clientVehicle.findMany({
    where: { clientId },
    orderBy: [{ updatedAt: 'desc' }],
    select: { make: true, model: true, year: true },
  });
  return vehicles;
}
