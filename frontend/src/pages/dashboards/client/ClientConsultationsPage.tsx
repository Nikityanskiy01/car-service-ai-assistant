import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { DashboardRecordCard } from '../../../components/dashboard/DashboardRecordCard';
import { PageHeader } from '../../../components/layout/dashboard/PageHeader';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loader } from '../../../components/ui/Loader';
import { formatConsultationSubtitle, formatConsultationTitle } from '../../../lib/consultationLabels';
import { STORAGE_KEYS } from '../../../lib/storageKeys';
import { usePageMeta } from '../../../hooks/usePageMeta';

type ConsultationRow = {
  id: string;
  status: string;
  createdAt: string;
  progressPercent?: number | null;
  make?: string | null;
  model?: string | null;
  symptoms?: string | null;
  extracted?: { make?: string | null; model?: string | null; symptoms?: string | null } | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ClientConsultationsPage() {
  usePageMeta({ title: 'Консультации', description: 'История ИИ-диагностики.' });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consultations, setConsultations] = useState<ConsultationRow[]>([]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api<ConsultationRow[]>('/consultations');
        setConsultations(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Loader label="Загружаем консультации..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Консультации"
        description="История сессий ИИ-диагностики. Продолжите диалог или начните новую."
        breadcrumbs={[
          { label: 'Кабинет', to: '/dashboard/client' },
          { label: 'Консультации' },
        ]}
        actions={
          <Link className="btn btn-primary" to="/consult">
            Новая диагностика
          </Link>
        }
      />

      <Card>
        {consultations.length === 0 ? (
          <EmptyState
            title="Консультаций ещё нет"
            description="Начните ИИ-диагностику — диалог сохранится здесь."
          />
        ) : (
          <div className="desk-record-list">
            {consultations.map((item) => (
              <DashboardRecordCard
                key={item.id}
                title={formatConsultationTitle(item)}
                subtitle={formatConsultationSubtitle(item.progressPercent)}
                meta={formatDate(item.createdAt)}
                status={item.status}
                icon={MessageSquare}
                onClick={() => {
                  sessionStorage.setItem(STORAGE_KEYS.consultSessionId, item.id);
                  navigate('/consult');
                }}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
