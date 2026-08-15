import { CalendarPlus, Droplets } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { oilLead, oilTitle, statusLabel } from './vehicleDetailLabels';
import type { LoadedVehicleDetail } from './useClientVehicleDetail';

export function VehicleOilPlanSection({ d }: { d: LoadedVehicleDetail }) {
  const { plan } = d;

  return (
    <section className={`service-book-oil is-${d.oilStatus}`} aria-label="План замены масла">
      <div className="service-book-oil-head">
        <span className="service-book-oil-icon" aria-hidden>
          <Droplets size={22} strokeWidth={2} />
        </span>
        <div className="service-book-oil-copy">
          <p className="service-book-oil-kicker">Замена масла</p>
          <h2 className="service-book-oil-title">{oilTitle(d.oilStatus)}</h2>
          <p className="service-book-oil-remain">
            {oilLead(d.oilStatus, d.remainCopy, plan?.intervalKm, plan?.intervalMonths)}
          </p>
        </div>
        <span className="service-book-oil-badge">{statusLabel(d.oilStatus)}</span>
      </div>

      {plan?.hasHistory && plan.plan ? (
        <>
          {d.progress ? (
            <div
              className={`service-book-oil-progress${d.progress.overdue ? ' is-overdue' : ''}`}
              role="meter"
              aria-label="Интервал до замены масла"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={d.progressPct}
            >
              <div className="service-book-oil-progress-meta">
                <span>Интервал {plan.intervalKm?.toLocaleString('ru-RU') ?? '7 500'} км</span>
                <span>{d.progress.overdue ? 'Просрочено' : `${d.progressPct}% интервала`}</span>
              </div>
              <div className="service-book-oil-progress-track">
                <div className="service-book-oil-progress-fill" style={{ width: `${d.progressPct}%` }} />
              </div>
            </div>
          ) : null}

          <div className="service-book-oil-grid">
            <div>
              <span>Последняя</span>
              <strong>
                {plan.lastRecord?.performedAt
                  ? new Date(plan.lastRecord.performedAt).toLocaleDateString('ru-RU')
                  : '—'}
              </strong>
              <em>
                {plan.lastRecord?.mileageKm != null
                  ? `${plan.lastRecord.mileageKm.toLocaleString('ru-RU')} км`
                  : 'пробег не указан'}
              </em>
            </div>
            <div>
              <span>Следующая</span>
              <strong>
                {plan.plan.nextDueAt ? new Date(plan.plan.nextDueAt).toLocaleDateString('ru-RU') : '—'}
              </strong>
              <em>
                {plan.plan.nextDueMileage != null
                  ? `${plan.plan.nextDueMileage.toLocaleString('ru-RU')} км`
                  : 'по дате'}
              </em>
            </div>
          </div>

          {d.oilUrgent ? (
            <div className="service-book-oil-actions">
              <Button type="button" onClick={d.bookOilChange}>
                <CalendarPlus size={16} aria-hidden />
                Записаться на замену
              </Button>
              <Button type="button" variant="secondary" onClick={() => d.openAddModal('oil_change')}>
                Уже менял — записать
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="service-book-oil-empty">
          <p>Нет записей о замене масла. Укажите прошлую — рассчитаем следующий срок.</p>
          <Button type="button" onClick={() => d.openAddModal('oil_change')}>
            Указать замену масла
          </Button>
        </div>
      )}
    </section>
  );
}
