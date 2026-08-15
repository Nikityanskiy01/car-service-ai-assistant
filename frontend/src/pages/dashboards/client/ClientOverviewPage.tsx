import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  Car,
  Droplets,
  MessageSquare,
  Plus,
  Wrench,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getClientDashboardSummary } from '../../../api/dashboard';
import {
  formatVehicleTitle,
  listVehicles,
  type ClientVehicle,
} from '../../../api/vehicles';
import { listMaintenanceAlerts, type MaintenanceAlert } from '../../../api/serviceRecords';
import { prefillOilChangeBookingFromPlan } from '../../../features/consultations/bookingPrefill';
import { CaseCard } from '../../../components/client/CaseCard';
import { ClientOverviewBookingSpotlight } from '../../../components/client/ClientOverviewBookingSpotlight';
import { ClientOverviewFocusStack } from '../../../components/client/ClientOverviewFocusStack';
import { ClientGarageAddCard, ClientGarageCard } from '../../../components/client/ClientGarageCard';
import { ClientStatusHelpButton } from '../../../components/client/ClientStatusHelp';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loader } from '../../../components/ui/Loader';
import type { ClientCase } from '../../../features/client-cases/types';
import { resolveClientCaseTopic } from '../../../features/client-cases/clientCaseTopic';
import { resolveClientOverviewSubtitle } from '../../../features/client-cases/resolveClientAlerts';
import { resolveClientOverviewFocus } from '../../../features/client-cases/resolveClientOverviewFocus';
import type { ClientDashboardSummary } from '../../../features/client-cases/resolveClientHero';
import { useProductConfig } from '../../../config/ProductConfigProvider';
import { usePageMeta } from '../../../hooks/usePageMeta';
import { bookingPath } from '../../../lib/bookingPath';
import { formatActiveCasesLabel, formatUnreadMessagesLabel } from '../../../lib/russianPlural';

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
    unreadCount: item.unreadCount || 0,
    topic: resolveClientCaseTopic({
      kind: item.kind,
      symptoms: item.symptoms,
      requestStatus: item.kind === 'request' ? item.status : undefined,
      progressStage: item.progressStage,
    }),
  };
}

export function ClientOverviewPage() {
  usePageMeta({
    title: 'Кабинет клиента',
    description: 'Гараж, обращения и ближайшие записи.',
  });

  const productConfig = useProductConfig();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ClientDashboardSummary | null>(null);
  const [vehicles, setVehicles] = useState<ClientVehicle[]>([]);
  const [oilAlerts, setOilAlerts] = useState<MaintenanceAlert[]>([]);

  async function loadOverview() {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, vehicleRows, alerts] = await Promise.all([
        getClientDashboardSummary(),
        listVehicles().catch(() => [] as ClientVehicle[]),
        listMaintenanceAlerts().catch(() => [] as MaintenanceAlert[]),
      ]);
      setSummary(summaryData);
      setVehicles(vehicleRows);
      setOilAlerts(alerts);
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

  const focus = useMemo(() => (summary ? resolveClientOverviewFocus(summary) : null), [summary]);
  const subtitle = useMemo(
    () => (summary ? resolveClientOverviewSubtitle(summary) : ''),
    [summary],
  );

  if (loading) return <Loader label="Загружаем кабинет..." />;
  if (error || !summary) {
    return (
      <ErrorState
        message={error || 'Не удалось загрузить кабинет'}
        onRetry={() => void loadOverview()}
      />
    );
  }

  const activeCases = summary.recentActiveCases.map(toClientCase);
  const isNewcomer = !summary.hasAnyHistory && !summary.draftConsultation;
  const visibleVehicles = vehicles.slice(0, 4);
  const hiddenVehiclesCount = Math.max(0, vehicles.length - visibleVehicles.length);
  const topOilAlert = oilAlerts[0] || null;
  const unreadInFocus =
    focus?.primary.kind === 'unread' || focus?.secondary.some((item) => item.kind === 'unread');
  const unreadStatTo =
    summary.unreadThreads?.length === 1
      ? `/dashboard/client/cases/${summary.unreadThreads[0].requestId}?tab=messages`
      : '/dashboard/client/cases';

  function bookFromOilAlert(alert: MaintenanceAlert) {
    prefillOilChangeBookingFromPlan({
      make: alert.make,
      model: alert.model,
      year: alert.year,
      nextDueAt: alert.plan?.nextDueAt,
      nextDueMileage: alert.plan?.nextDueMileage,
    });
    navigate(bookingPath(alert.vehicleId));
  }

  return (
    <div className="stack dashboard-page client-overview">
      <header className="client-overview-header">
        <div className="client-overview-intro">
          <div className="client-overview-title-row">
            <div>
              <p className="client-overview-greeting">
                {summary.profile.fullName ? `${greeting}, ${summary.profile.fullName}` : greeting}
              </p>
              <p className="client-overview-subtitle">{subtitle}</p>
            </div>
            <ClientStatusHelpButton />
          </div>
          <div className="client-overview-stats" aria-label="Сводка">
            {summary.activeCasesCount > 0 ? (
              <Link className="client-overview-stat" to="/dashboard/client/cases">
                <span className="client-overview-stat-icon" aria-hidden>
                  <Wrench size={14} />
                </span>
                {formatActiveCasesLabel(summary.activeCasesCount)}
              </Link>
            ) : null}
            {summary.unreadMessagesCount > 0 && !unreadInFocus ? (
              <Link className="client-overview-stat is-highlight" to={unreadStatTo}>
                <span className="client-overview-stat-icon" aria-hidden>
                  <MessageSquare size={14} />
                </span>
                {formatUnreadMessagesLabel(summary.unreadMessagesCount)}
              </Link>
            ) : null}
            {vehicles.length > 0 ? (
              <Link className="client-overview-stat" to="/dashboard/client/vehicles">
                <span className="client-overview-stat-icon" aria-hidden>
                  <Car size={14} />
                </span>
                <strong>{vehicles.length}</strong> авто
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {focus ? <ClientOverviewFocusStack primary={focus.primary} secondary={focus.secondary} /> : null}

      {summary.nextBooking ? (
        <ClientOverviewBookingSpotlight
          booking={summary.nextBooking}
          serviceName={productConfig.shortName}
          serviceAddress={productConfig.address || ''}
        />
      ) : null}

      {topOilAlert ? (
        <div
          className={`service-oil-alert client-overview-focus-primary is-compact ${
            topOilAlert.status === 'overdue' ? 'is-accent-overdue' : 'is-accent-soon'
          }`}
          data-status={topOilAlert.status}
        >
          <div className="client-overview-focus-primary-inner service-oil-alert-inner">
            <div className="client-overview-focus-primary-head">
              <span className="client-overview-focus-primary-icon service-oil-alert-icon" aria-hidden>
                <Droplets size={18} strokeWidth={2.1} />
              </span>
              <div className="service-oil-alert-copy">
                <p className="client-overview-focus-kicker">Обслуживание</p>
                <strong className="service-oil-alert-title">
                  {topOilAlert.status === 'overdue'
                    ? 'Пора менять масло'
                    : 'Скоро замена масла'}
                </strong>
                <ul className="service-oil-alert-meta">
                  <li>{formatVehicleTitle(topOilAlert)}</li>
                  {topOilAlert.plan?.nextDueAt ? (
                    <li>
                      до {new Date(topOilAlert.plan.nextDueAt).toLocaleDateString('ru-RU')}
                    </li>
                  ) : null}
                  {topOilAlert.plan?.nextDueMileage != null ? (
                    <li>
                      {topOilAlert.plan.nextDueMileage.toLocaleString('ru-RU')} км
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
            <div className="service-oil-alert-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm service-oil-alert-cta"
                onClick={() => bookFromOilAlert(topOilAlert)}
              >
                <CalendarDays size={15} aria-hidden />
                Записаться
              </button>
              <Link
                className="btn btn-secondary btn-sm"
                to={`/dashboard/client/vehicles/${topOilAlert.vehicleId}`}
              >
                История
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <nav className="client-overview-quickbar" aria-label="Быстрые действия">
        <Link to="/consult" className="client-overview-quickbar-item">
          <MessageSquare size={16} aria-hidden />
          Диагностика
        </Link>
        <Link to="/booking" className="client-overview-quickbar-item">
          <CalendarDays size={16} aria-hidden />
          Запись
        </Link>
        <Link to="/services" className="client-overview-quickbar-item">
          <Wrench size={16} aria-hidden />
          Услуги
        </Link>
        <Link to="/dashboard/client/cases" className="client-overview-quickbar-item">
          <Car size={16} aria-hidden />
          Обращения
        </Link>
      </nav>

      {isNewcomer ? (
        <Card className="client-overview-welcome">
          <EmptyState
            title="Добро пожаловать в кабинет"
            description="Опишите симптомы в ИИ-чате — мы подскажем возможные причины и поможем записаться в сервис."
            action={
              <div className="row gap-sm">
                <Link className="btn btn-primary" to="/consult">
                  Начать диагностику
                </Link>
                <Link className="btn btn-secondary" to="/dashboard/client/vehicles">
                  Добавить автомобиль
                </Link>
              </div>
            }
          />
          <ol className="desk-steps client-overview-steps">
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

      {activeCases.length > 0 ? (
        <section className="client-overview-section client-overview-panel" aria-label="Активные обращения">
          <div className="card-section-header">
            <h2>В работе</h2>
            <Link to="/dashboard/client/cases">
              Все ({summary.activeCasesCount}) <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
          <div className="client-overview-cases">
            {activeCases.slice(0, 2).map((item) => (
              <CaseCard key={item.id} clientCase={item} compact />
            ))}
          </div>
        </section>
      ) : !isNewcomer && !focus ? (
        <Card className="client-overview-idle">
          <p className="muted-text">
            Сейчас нет активных обращений — если появится проблема, начните с диагностики.
          </p>
          <Link className="btn btn-primary btn-sm" to="/consult">
            Новая диагностика
          </Link>
        </Card>
      ) : null}

      {!isNewcomer ? (
        <section className="client-overview-section client-overview-panel client-overview-garage" aria-label="Мой гараж">
          <div className="card-section-header">
            <div className="client-overview-garage-heading">
              <h2>Мой гараж</h2>
              {vehicles.length > 0 ? (
                <span className="client-overview-garage-count">{vehicles.length}</span>
              ) : null}
            </div>
            <Link to="/dashboard/client/vehicles">Управлять</Link>
          </div>
          {vehicles.length === 0 ? (
            <div className="client-overview-garage-empty">
              <p className="muted-text">
                Добавьте автомобиль вручную или пройдите диагностику — машина появится здесь автоматически.
              </p>
              <div className="row gap-sm">
                <Link className="btn btn-primary btn-sm" to="/dashboard/client/vehicles">
                  <Plus size={16} aria-hidden />
                  Добавить авто
                </Link>
                <Link className="btn btn-secondary btn-sm" to="/consult">
                  Начать диагностику
                </Link>
              </div>
            </div>
          ) : (
            <div className="client-garage-rail">
              {visibleVehicles.map((vehicle) => (
                <ClientGarageCard key={vehicle.id} vehicle={vehicle} />
              ))}
              <ClientGarageAddCard to="/dashboard/client/vehicles" />
            </div>
          )}
          {hiddenVehiclesCount > 0 ? (
            <p className="muted-text client-overview-more-link">
              <Link to="/dashboard/client/vehicles">
                Ещё {hiddenVehiclesCount} в профиле <ArrowRight size={14} aria-hidden />
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
