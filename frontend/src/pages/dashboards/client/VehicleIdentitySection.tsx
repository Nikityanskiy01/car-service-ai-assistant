import { ArrowLeft, CalendarPlus, Download, Droplets, Gauge, Pencil, Plus, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { downloadApiFile } from '../../../api/client';
import { VehiclePhotoPicker } from '../../../components/client/VehiclePhotoPicker';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { statusLabel } from './vehicleDetailLabels';
import type { LoadedVehicleDetail } from './useClientVehicleDetail';

export function VehicleIdentitySection({ d }: { d: LoadedVehicleDetail }) {
  const { vehicle } = d;

  return (
    <>
      <div className="service-book-top">
        <Link to="/dashboard/client/vehicles" className="service-book-back">
          <ArrowLeft size={16} aria-hidden />
          К гаражу
        </Link>
        <button type="button" className="service-book-edit-link" onClick={() => d.setMetaOpen(true)}>
          <Pencil size={14} aria-hidden />
          Данные
        </button>
      </div>

      {d.error ? <p className="form-error">{d.error}</p> : null}

      <section className="service-book-identity" aria-label="Автомобиль">
        <div className="service-book-identity-media">
          <VehiclePhotoPicker vehicle={vehicle} size="lg" onUpdated={(updated) => d.setVehicle(updated)} />
        </div>

        <div className="service-book-identity-body">
          <div className="service-book-identity-heading">
            <h1>{d.titleText}</h1>
            <div className="service-book-identity-meta">
              {vehicle.year ? <span>{vehicle.year} г.</span> : null}
              {vehicle.licensePlate ? (
                <span className="garage-plate is-compact">{vehicle.licensePlate}</span>
              ) : null}
              {vehicle.color ? <span>{vehicle.color}</span> : null}
              {vehicle.vin ? <span className="service-book-vin">VIN ···{vehicle.vin.slice(-6)}</span> : null}
            </div>
          </div>

          <div className="service-book-facts" aria-label="Ключевые данные">
            <div className="service-book-fact">
              <span className="service-book-fact-icon" aria-hidden>
                <Gauge size={16} />
              </span>
              <div className="service-book-fact-copy">
                <span className="service-book-fact-label">Пробег</span>
                {d.mileageEdit ? (
                  <form className="service-book-mileage-edit" onSubmit={(e) => void d.handleSaveMileage(e)}>
                    <Input
                      id="vehicle-mileage"
                      type="number"
                      min={0}
                      value={d.mileageDraft}
                      onChange={(e) => d.setMileageDraft(e.target.value)}
                      placeholder="45200"
                      autoFocus
                      aria-label="Текущий пробег, км"
                    />
                    <Button type="submit" disabled={d.savingMileage}>
                      {d.savingMileage ? '…' : 'OK'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        d.setMileageDraft(
                          vehicle.currentMileageKm != null ? String(vehicle.currentMileageKm) : '',
                        );
                        d.setMileageEdit(false);
                      }}
                    >
                      Отмена
                    </Button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="service-book-fact-value is-action"
                    onClick={() => d.setMileageEdit(true)}
                  >
                    <strong>{d.mileageDisplay}</strong>
                    <span>изменить</span>
                  </button>
                )}
              </div>
            </div>

            <div className="service-book-fact">
              <span className="service-book-fact-icon" aria-hidden>
                <Wrench size={16} />
              </span>
              <div className="service-book-fact-copy">
                <span className="service-book-fact-label">Последний сервис</span>
                <strong className="service-book-fact-value">{d.lastServiceLabel || 'ещё не было'}</strong>
                {vehicle.lastServiceTitle ? (
                  <span className="service-book-fact-sub">{vehicle.lastServiceTitle}</span>
                ) : null}
              </div>
            </div>

            <div className={`service-book-fact is-oil is-${d.oilStatus}`}>
              <span className="service-book-fact-icon" aria-hidden>
                <Droplets size={16} />
              </span>
              <div className="service-book-fact-copy">
                <span className="service-book-fact-label">Масло</span>
                <strong className="service-book-fact-value">{statusLabel(d.oilStatus)}</strong>
                {d.remainCopy ? <span className="service-book-fact-sub">{d.remainCopy}</span> : null}
              </div>
            </div>
          </div>

          <div className="service-book-quick-actions">
            {d.oilUrgent ? (
              <Button type="button" onClick={d.bookOilChange}>
                <CalendarPlus size={16} aria-hidden />
                Записаться на замену
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={d.bookOilChange}>
                <CalendarPlus size={16} aria-hidden />
                Записаться
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={() => d.openAddModal()}>
              <Plus size={16} aria-hidden />
              Добавить работу
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                void downloadApiFile(
                  `/api/vehicles/${vehicle.id}/service-history/export.pdf`,
                  `service-history-${vehicle.id.slice(0, 8)}.pdf`,
                )
              }
            >
              <Download size={16} aria-hidden />
              PDF книжки
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
