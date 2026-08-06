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

  function bookFromOilAlert(alert: MaintenanceAlert) {
    prefillOilChangeBookingFromPlan({
      make: alert.make,
      model: alert.model,
      year: alert.year,
      nextDueAt: alert.plan?.nextDueAt,
      nextDueMileage: alert.plan?.nextDueMileage,
    });
    navigate('/booking');
  }

  return (
    <div className="stack dashboard-page client-overview">
      <header className="client-overview-header">
        <div className="client-overview-intro">
          <p className="client-overview-greeting">
            {summary.profile.fullName ? `${greeting}, ${summary.profile.fullName}` : greeting}
          </p>
          <p className="client-overview-subtitle">{subtitle}</p>
          {topOilAlert ? (
            <div
              className={`service-oil-alert client-overview-focus-primary ${
                topOilAlert.status === 'overdue' ? 'is-accent-overdue' : 'is-accent-soon'
              }`}
              data-status={topOilAlert.status}
            >
              <div className="client-overview-focus-primary-inner service-oil-alert-inner">
                <div className="client-overview-focus-primary-head">
                  <span className="client-overview-focus-primary-icon" aria-hidden>
                    <Droplets size={18} />
                  </span>
                  <div>
                    <p className="client-overview-focus-kicker">Обслуживание</p>
                    <strong>
                      {topOilAlert.status === 'overdue'
                        ? 'Пора менять масло'
                        : 'Скоро замена масла'}
                    </strong>
                    <p className="muted service-oil-alert-meta">
                      {formatVehicleTitle(topOilAlert)}
                      {topOilAlert.plan?.nextDueAt
                        ? ` · до ${new Date(topOilAlert.plan.nextDueAt).toLocaleDateString('ru-RU')}`
                        : ''}
                      {topOilAlert.plan?.nextDueMileage != null
                        ? ` · ${topOilAlert.plan.nextDueMileage.toLocaleString('ru-RU')} км`
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="service-oil-alert-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => bookFromOilAlert(topOilAlert)}
                  >
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
          <div className="client-overview-stats" aria-label="Сводка">
            {summary.activeCasesCount > 0 ? (
              <Link className="client-overview-stat" to="/dashboard/client/cases">
                <Wrench size={14} aria-hidden />
                {formatActiveCasesLabel(summary.activeCasesCount)}
              </Link>
            ) : null}
            {summary.unreadMessagesCount > 0 ? (
              <Link className="client-overview-stat is-highlight" to="/dashboard/client/cases">
                <MessageSquare size={14} aria-hidden />
                {formatUnreadMessagesLabel(summary.unreadMessagesCount)}
              </Link>
            ) : null}
            {vehicles.length > 0 ? (
              <Link className="client-overview-stat" to="/dashboard/client/vehicles">
                <Car size={14} aria-hidden />
                <strong>{vehicles.length}</strong> авто
              </Link>
            ) : null}
          </div>
        </div>
        <ClientStatusHelpButton />
      </header>

      {summary.nextBooking ? (
        <ClientOverviewBookingSpotlight
          booking={summary.nextBooking}
          serviceName={productConfig.shortName}
          serviceAddress={productConfig.address || ''}
        />
      ) : null}

      {focus ? <ClientOverviewFocusStack primary={focus.primary} secondary={focus.secondary} /> : null}

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

      <div className="client-overview-layout">
        <div className="client-overview-main">
          {activeCases.length > 0 ? (
            <section className="client-overview-section client-overview-panel" aria-label="Активные обращения">
              <div className="card-section-header">
                <h2>В работе</h2>
                <Link to="/dashboard/client/cases">
                  Все ({summary.activeCasesCount}) <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
              <div className="client-overview-cases">
                {activeCases.slice(0, 3).map((item) => (
                  <CaseCard key={item.id} clientCase={item} compact />
                ))}
              </div>
            </section>
          ) : !isNewcomer ? (
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

        <aside className="client-overview-aside" aria-label="Быстрые действия">
          <section className="client-overview-actions-panel">
            <h2>Быстрые действия</h2>
            <div className="client-overview-actions">
              <Link to="/consult" className="client-overview-action">
                <MessageSquare size={18} aria-hidden />
                <span>Диагностика</span>
              </Link>
              <Link to="/booking" className="client-overview-action">
                <CalendarDays size={18} aria-hidden />
                <span>Запись</span>
              </Link>
              <Link to="/services" className="client-overview-action">
                <Wrench size={18} aria-hidden />
                <span>Услуги</span>
              </Link>
              <Link to="/dashboard/client/cases" className="client-overview-action">
                <Car size={18} aria-hidden />
                <span>Обращения</span>
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
