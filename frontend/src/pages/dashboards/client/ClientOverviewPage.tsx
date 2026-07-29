import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, Car, MessageSquare, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getClientDashboardSummary } from '../../../api/dashboard';
import { CaseCard } from '../../../components/client/CaseCard';
import { DashboardRecordCard } from '../../../components/dashboard/DashboardRecordCard';
import { DashboardWelcomeHero } from '../../../components/dashboard/DashboardWelcomeHero';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loader } from '../../../components/ui/Loader';
import type { ClientCase } from '../../../features/client-cases/types';
import {
  resolveClientHero,
  type ClientDashboardSummary,
} from '../../../features/client-cases/resolveClientHero';
import { clientBookingStatusLabel } from '../../../lib/clientStatusLabels';
import { buildBookingIcs, downloadBookingIcs } from '../../../lib/buildBookingIcs';
import { useProductConfig } from '../../../config/ProductConfigProvider';
import { STORAGE_KEYS } from '../../../lib/storageKeys';
import { usePageMeta } from '../../../hooks/usePageMeta';

function formatDate(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toClientCase(item: ClientDashboardSummary['recentActiveCases'][number]): ClientCase {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    symptoms: item.symptoms,
    status: item.status,
    progressStage: item.progressStage,
    progressPercent: item.progressPercent,
    progressLabel: item.progressLabel,
    lastActivityAt: item.lastActivityAt,
    urgency: item.urgency,
    serviceRequestId: item.serviceRequestId ?? undefined,
    consultationSessionId: item.consultationSessionId ?? undefined,
  };
}

export function ClientOverviewPage() {
  usePageMeta({
    title: 'Кабинет клиента',
    description: 'Обзор обращений, записей и следующих шагов.',
  });

  const navigate = useNavigate();
  const productConfig = useProductConfig();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ClientDashboardSummary | null>(null);

  async function loadOverview() {
    setLoading(true);
    setError(null);
    try {
      setSummary(await getClientDashboardSummary());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки кабинета');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Доброе утро';
    if (hour < 18) return 'Добрый день';
    return 'Добрый вечер';
  }, []);

  const hero = useMemo(() => (summary ? resolveClientHero(summary) : null), [summary]);

  function handleHeroCta() {
    if (!hero) return;
    if (hero.ctaSessionId) {
      sessionStorage.setItem(STORAGE_KEYS.consultSessionId, hero.ctaSessionId);
    }
    navigate(hero.ctaTo);
  }

  if (loading) return <Loader label="Загружаем кабинет..." />;
  if (error || !summary || !hero) return <ErrorState message={error || 'Не удалось загрузить кабинет'} onRetry={() => void loadOverview()} />;

  const activeCases = summary.recentActiveCases.map(toClientCase);
  const showOnboarding = !summary.hasAnyHistory;

  return (
    <div className="stack dashboard-page">
      <DashboardWelcomeHero
        icon={Car}
        greeting={summary.profile.fullName ? `${greeting}, ${summary.profile.fullName}` : greeting}
        title={hero.title}
        description={hero.description}
        actions={
          <div className="page-header-actions">
            <button type="button" className="btn btn-primary" onClick={handleHeroCta}>
              {hero.ctaLabel}
            </button>
            {hero.secondaryTo ? (
              <Link className="btn btn-secondary" to={hero.secondaryTo}>
                {hero.secondaryLabel}
              </Link>
            ) : (
              <Link className="btn btn-secondary" to="/booking">
                Записаться
              </Link>
            )}
          </div>
        }
      />

      {summary.unreadMessagesCount > 0 ? (
        <div className="form-status client-unread-banner" role="status">
          У вас {summary.unreadMessagesCount}{' '}
          {summary.unreadMessagesCount === 1
            ? 'новое сообщение от менеджера'
            : summary.unreadMessagesCount < 5
              ? 'новых сообщения от менеджера'
              : 'новых сообщений от менеджера'}
          .{' '}
          <Link to="/dashboard/client/cases">Открыть обращения</Link>
        </div>
      ) : null}

      {hero.isNewcomer ? (
        <Card className="client-newcomer-card">
          <EmptyState
            title="Добро пожаловать в кабинет"
            description="Опишите симптомы в ИИ-чате — мы подскажем возможные причины и поможем записаться в сервис."
            action={
              <Link className="btn btn-primary" to="/consult">
                Начать диагностику
              </Link>
            }
          />
        </Card>
      ) : null}

      {activeCases.length > 0 ? (
        <section className="stack" aria-label="Активные обращения">
          <div className="card-section-header">
            <h2>Активное</h2>
            <Link to="/dashboard/client/cases">Все обращения</Link>
          </div>
          <div className="case-card-rail">
            {activeCases.map((item) => (
              <CaseCard key={item.id} clientCase={item} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="desk-action-grid" aria-label="Быстрые действия">
        <Link to="/consult" className="desk-action-card">
          <MessageSquare size={20} aria-hidden />
          <div>
            <strong>Новая диагностика</strong>
            <span>Опишите симптомы в чате</span>
          </div>
        </Link>
        <Link to="/booking" className="desk-action-card">
          <CalendarDays size={20} aria-hidden />
          <div>
            <strong>Запись в сервис</strong>
            <span>Выберите удобное время</span>
          </div>
        </Link>
        <Link to="/services" className="desk-action-card">
          <Wrench size={20} aria-hidden />
          <div>
            <strong>Каталог услуг</strong>
            <span>Цены и направления работ</span>
          </div>
        </Link>
      </section>

      {summary.nextBooking ? (
        <Card>
          <div className="card-section-header">
            <h2>Ближайший визит</h2>
            <Link to="/dashboard/client/bookings">Все записи</Link>
          </div>
          <DashboardRecordCard
            title={formatDate(summary.nextBooking.preferredAt)}
            subtitle={clientBookingStatusLabel(summary.nextBooking.status)}
            status={summary.nextBooking.status}
            icon={CalendarDays}
            to={`/dashboard/client/bookings/${summary.nextBooking.id}`}
            actions={
              <Button
                type="button"
                variant="ghost"
                className="btn-sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const ics = buildBookingIcs({
                    id: summary.nextBooking!.id,
                    preferredAt: summary.nextBooking!.preferredAt,
                    title: `Визит — ${productConfig.shortName}`,
                    location: productConfig.address,
                  });
                  downloadBookingIcs(ics, `booking-${summary.nextBooking!.id}.ics`);
                }}
              >
                .ics
              </Button>
            }
          />
        </Card>
      ) : null}

      {showOnboarding ? (
        <Card>
          <div className="card-section-header">
            <h2>Как это работает</h2>
          </div>
          <ol className="desk-steps">
            <li>
              <span className="desk-step-num">1</span>
              <div>
                <strong>ИИ-диагностика</strong>
                <p>Опишите симптомы — система подскажет возможные причины.</p>
              </div>
            </li>
            <li>
              <span className="desk-step-num">2</span>
              <div>
                <strong>Заявка мастеру</strong>
                <p>Из консультации создаётся заявка — менеджер увидит историю.</p>
              </div>
            </li>
            <li>
              <span className="desk-step-num">3</span>
              <div>
                <strong>Запись и ремонт</strong>
                <p>Запишитесь на удобное время и отслеживайте статус здесь.</p>
              </div>
            </li>
          </ol>
        </Card>
      ) : null}
    </div>
  );
}
