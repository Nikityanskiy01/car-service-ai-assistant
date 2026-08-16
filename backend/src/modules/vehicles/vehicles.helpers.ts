import type { ClientVehicle } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import type {
  PublicVehicle,
  VehicleCaseCount,
  VehicleLatestService,
} from './vehicles.types.js';

export function norm(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

export function vehicleFingerprint(make: unknown, model: unknown, year: unknown) {
  return `${norm(make)}|${norm(model)}|${year ?? ''}`;
}

export function publicPhotoUrl(vehicleId: string, photoUrl?: string | null) {
  if (!photoUrl) return null;
  return `/api/vehicles/${vehicleId}/photo`;
}

export function serializeVehicle(vehicle: ClientVehicle): PublicVehicle {
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

export async function getLatestServiceByVehicle(vehicleIds: string[]) {
  if (!vehicleIds.length) return {};
  const rows = await prisma.vehicleServiceRecord.findMany({
    where: { vehicleId: { in: vehicleIds } },
    orderBy: [{ performedAt: 'desc' }],
    select: { vehicleId: true, performedAt: true, title: true, category: true },
  });
  const latest: Record<string, VehicleLatestService> = {};
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

export async function getVehicleCaseCounts(clientId: string, vehicleIds: string[]) {
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

  const counts: Record<string, VehicleCaseCount> = Object.fromEntries(
    vehicleIds.map((id) => [id, { active: 0, total: 0 }]),
  );

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

export async function findVehicleByFingerprint(
  clientId: string,
  make: unknown,
  model: unknown,
  year: unknown,
) {
  const vehicles = await prisma.clientVehicle.findMany({ where: { clientId } });
  const fingerprint = vehicleFingerprint(make, model, year);
  return vehicles.find((vehicle) => vehicleFingerprint(vehicle.make, vehicle.model, vehicle.year) === fingerprint) || null;
}

export async function getExcludedFingerprints(clientId: string) {
  const rows = await prisma.clientVehicleExclusion.findMany({
    where: { clientId },
    select: { fingerprint: true },
  });
  return new Set(rows.map((row) => row.fingerprint));
}

export async function excludeVehicleFingerprint(
  clientId: string,
  make: unknown,
  model: unknown,
  year: unknown,
) {
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

export async function clearVehicleExclusion(
  clientId: string,
  make: unknown,
  model: unknown,
  year: unknown,
) {
  const fingerprint = vehicleFingerprint(make, model, year);
  await prisma.clientVehicleExclusion.deleteMany({
    where: { clientId, fingerprint },
  });
}

export function isFingerprintExcluded(
  excluded: Set<string>,
  make: unknown,
  model: unknown,
  year: unknown,
) {
  return excluded.has(vehicleFingerprint(make, model, year));
}
