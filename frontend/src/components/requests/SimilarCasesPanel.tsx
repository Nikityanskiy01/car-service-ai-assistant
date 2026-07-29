import { useEffect, useState } from 'react';
import { getSimilarCases, type SimilarCase } from '../../api/dashboard';
import { EmptyState } from '../ui/EmptyState';
import { Loader } from '../ui/Loader';

type Props = {
  requestId: string;
};

function formatRubles(minor: number | null | undefined) {
  if (minor == null) return null;
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

export function SimilarCasesPanel({ requestId }: Props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SimilarCase[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void getSimilarCases(requestId)
      .then((data) => setItems(data.items))
      .catch((e) => setError(e instanceof Error ? e.message : 'Не удалось загрузить кейсы'))
      .finally(() => setLoading(false));
  }, [requestId]);

  if (loading) return <Loader />;
  if (error) return <p className="form-error">{error}</p>;
  if (!items.length) {
    return (
      <EmptyState
        title="Похожих кейсов нет"
        description="По мере накопления истории ремонтов здесь появятся аналоги."
      />
    );
  }

  return (
    <section className="similar-cases-panel stack">
      <header>
        <h3>Похожие кейсы</h3>
        <p className="muted">Анонимизированные случаи из памяти сервиса с похожими симптомами.</p>
      </header>
      <ul className="similar-cases-list">
        {items.map((item, index) => (
          <li key={`${item.make}-${item.model}-${index}`} className="similar-case-card">
            <strong>
              {[item.make, item.model].filter(Boolean).join(' ') || 'Авто не указано'}
            </strong>
            {item.symptomCategory ? (
              <span className="similar-case-tag">{item.symptomCategory}</span>
            ) : null}
            {item.topRecommendations?.length ? (
              <ul>
                {item.topRecommendations.map((rec) => (
                  <li key={rec}>{rec}</li>
                ))}
              </ul>
            ) : null}
            {item.costFromMinor != null ? (
              <p className="muted">Стоимость от: {formatRubles(item.costFromMinor)}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
