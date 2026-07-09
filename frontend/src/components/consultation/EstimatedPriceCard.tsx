export function EstimatedPriceCard({ amount }: { amount?: number | null }) {
  return (
    <section className="price-card" aria-label="Предварительная стоимость">
      <h4>Предварительная стоимость</h4>
      <p className="price-value">{amount ? `от ${amount.toLocaleString('ru-RU')} ₽` : 'Требуются уточнения'}</p>
      <small>Финальная стоимость определяется после очной технической диагностики.</small>
    </section>
  );
}
