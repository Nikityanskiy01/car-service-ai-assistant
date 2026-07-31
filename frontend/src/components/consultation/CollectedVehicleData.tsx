import type { ConsultationExtractedData } from '../../types/consultation';

const CHIP_FIELDS = [
  { label: 'Марка', key: 'make' as const },
  { label: 'Модель', key: 'model' as const },
  { label: 'Год', key: 'year' as const },
  { label: 'Пробег', key: 'mileage' as const },
  { label: 'Симптомы', key: 'symptoms' as const },
];

function chipValue(data: ConsultationExtractedData | null | undefined, key: (typeof CHIP_FIELDS)[number]['key']): string {
  if (!data) return '';
  if (key === 'year') return data.year ? String(data.year) : '';
  if (key === 'mileage') return data.mileage ? `${data.mileage} км` : '';
  const raw = data[key];
  return raw ? String(raw) : '';
}

export function VehicleDataChips({ data }: { data: ConsultationExtractedData | null | undefined }) {
  return (
    <div className="consult-data-section">
      <p className="consult-data-label">Что мы поняли</p>
      <div className="consult-data-chips">
        {CHIP_FIELDS.map((field) => {
          const value = chipValue(data, field.key);
          return (
            <span key={field.label} className={value ? 'is-filled' : undefined} title={value || field.label}>
              {value ? `${field.label}: ${value}` : field.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** @deprecated Use VehicleDataChips inside ConsultationProgress */
export function CollectedVehicleData({
  data,
  progress = 0,
}: {
  data: ConsultationExtractedData | null | undefined;
  progress?: number;
}) {
  const filled = CHIP_FIELDS.filter((f) => Boolean(chipValue(data, f.key))).length;
  const readiness = Math.max(progress, Math.round((filled / CHIP_FIELDS.length) * 100));

  return (
    <section className="data-card" aria-label="Готовность данных">
      <div className="progress-head">
        <h3>Готовность данных</h3>
        <strong>{readiness}%</strong>
      </div>
      <div className="progress-track compact" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={readiness}>
        <span style={{ width: `${Math.max(0, Math.min(100, readiness))}%` }} />
      </div>
      <VehicleDataChips data={data} />
      <p className="consult-data-hint">
        Чем точнее укажете марку, модель, год, пробег и симптомы — тем полезнее будет предварительный разбор.
      </p>
    </section>
  );
}
