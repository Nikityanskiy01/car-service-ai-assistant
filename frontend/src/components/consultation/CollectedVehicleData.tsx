import type { ConsultationExtractedData } from '../../types/consultation';

export function CollectedVehicleData({ data }: { data: ConsultationExtractedData | null | undefined }) {
  const rows = [
    { label: 'Марка', value: data?.make },
    { label: 'Модель', value: data?.model },
    { label: 'Год', value: data?.year ? String(data.year) : '' },
    { label: 'Пробег', value: data?.mileage ? `${data.mileage} км` : '' },
    { label: 'Симптомы', value: data?.symptoms },
    { label: 'Условия проявления', value: data?.problemConditions },
  ];
  return (
    <section className="data-card" aria-label="Собранные данные автомобиля">
      <h3>Собранные данные</h3>
      <dl>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value || 'Не указан'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
