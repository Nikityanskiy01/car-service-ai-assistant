import { describe, expect, it, vi, beforeEach } from 'vitest';

const prismaMock = {
  clientVehicle: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  clientVehicleExclusion: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  consultationSession: {
    updateMany: vi.fn(),
  },
  serviceRequest: {
    updateMany: vi.fn(),
  },
  $transaction: vi.fn((ops) => Promise.all(ops)),
};

vi.mock('../../src/lib/prisma.js', () => ({
  default: prismaMock,
}));

const { deleteVehicle } = await import('../../src/modules/vehicles/vehicles.service.js');

describe('deleteVehicle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('excludes fingerprint and removes duplicate garage entries', async () => {
    const clientId = 'client-1';
    const vehicle = {
      id: 'vehicle-a',
      clientId,
      make: 'Toyota',
      model: 'Camry',
      year: 2018,
    };

    prismaMock.clientVehicle.findFirst.mockResolvedValue(vehicle);
    prismaMock.clientVehicleExclusion.upsert.mockResolvedValue({});
    prismaMock.clientVehicle.findMany.mockResolvedValue([
      vehicle,
      { id: 'vehicle-b', clientId, make: 'Toyota', model: 'Camry', year: 2018 },
      { id: 'vehicle-c', clientId, make: 'Kia', model: 'Rio', year: 2020 },
    ]);

    await deleteVehicle(clientId, vehicle.id);

    expect(prismaMock.clientVehicleExclusion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          clientId,
          fingerprint: 'toyota|camry|2018',
        }),
      }),
    );
    expect(prismaMock.clientVehicle.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['vehicle-a', 'vehicle-b'] }, clientId },
    });
  });
});
