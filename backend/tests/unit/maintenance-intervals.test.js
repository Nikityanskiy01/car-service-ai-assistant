import { computeOilChangeDue, buildOilMaintenancePlan, OIL_CHANGE } from '../../src/lib/maintenanceIntervals.js';

describe('maintenanceIntervals', () => {
  test('uses 7500 km / 6 months', () => {
    expect(OIL_CHANGE.km).toBe(7500);
    expect(OIL_CHANGE.months).toBe(6);
  });

  test('computes next due from date and mileage', () => {
    const plan = computeOilChangeDue({
      performedAt: '2026-01-01T00:00:00.000Z',
      mileageKm: 10000,
      currentMileageKm: 12000,
      now: new Date('2026-03-01T00:00:00.000Z'),
    });
    expect(plan.nextDueMileage).toBe(17500);
    expect(plan.status).toBe('ok');
    expect(plan.kmLeft).toBe(5500);
  });

  test('marks soon by remaining km', () => {
    const plan = computeOilChangeDue({
      performedAt: '2026-01-01T00:00:00.000Z',
      mileageKm: 10000,
      currentMileageKm: 17200,
      now: new Date('2026-02-01T00:00:00.000Z'),
    });
    expect(plan.status).toBe('soon');
  });

  test('marks overdue by date even if km left', () => {
    const plan = computeOilChangeDue({
      performedAt: '2025-01-01T00:00:00.000Z',
      mileageKm: 10000,
      currentMileageKm: 11000,
      now: new Date('2026-08-01T00:00:00.000Z'),
    });
    expect(plan.status).toBe('overdue');
  });

  test('buildOilMaintenancePlan picks latest oil change', () => {
    const result = buildOilMaintenancePlan(
      [
        {
          performedAt: '2025-01-01',
          mileageKm: 5000,
          category: 'oil_change',
          title: 'Старое масло',
        },
        {
          performedAt: '2026-02-01',
          mileageKm: 12000,
          category: 'oil_change',
          title: 'Новое масло',
        },
        {
          performedAt: '2026-03-01',
          mileageKm: 13000,
          category: 'brakes',
          title: 'Колодки',
        },
      ],
      { currentMileageKm: 13000, now: new Date('2026-03-15') },
    );
    expect(result.hasHistory).toBe(true);
    expect(result.lastRecord.mileageKm).toBe(12000);
    expect(result.plan.nextDueMileage).toBe(19500);
  });
});
