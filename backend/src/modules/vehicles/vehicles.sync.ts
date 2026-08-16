import prisma from '../../lib/prisma.js';
import {
  vehicleFingerprint,
  getExcludedFingerprints,
  isFingerprintExcluded,
  findVehicleByFingerprint,
} from './vehicles.helpers.js';
import type { VehicleIdentity } from './vehicles.types.js';

export async function findOrCreateVehicleForClient(
  clientId: string,
  { make, model, year }: VehicleIdentity,
  source = 'imported',
) {
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

export async function linkSessionToVehicle(sessionId: string, clientId: string | null, { make, model, year }: VehicleIdentity) {
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

export async function syncVehiclesFromHistory(clientId: string) {
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
const vehicleSyncAt = new Map<string, number>();
const VEHICLE_SYNC_TTL_MS = 5 * 60 * 1000;

export async function syncVehiclesFromHistoryThrottled(clientId: string) {
  const last = vehicleSyncAt.get(clientId) || 0;
  if (Date.now() - last < VEHICLE_SYNC_TTL_MS) return;
  vehicleSyncAt.set(clientId, Date.now());
  await syncVehiclesFromHistory(clientId);
}
