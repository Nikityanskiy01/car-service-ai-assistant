import { ChevronDown, Droplets, Wrench } from 'lucide-react';
import { FormField } from '../../../components/forms/FormField';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { CATEGORY_OPTIONS, categoryTitle } from './vehicleDetailLabels';
import type { LoadedVehicleDetail } from './useClientVehicleDetail';

export function VehicleDetailDialogs({ d }: { d: LoadedVehicleDetail }) {
  const { vehicle } = d;

  return (
    <>
      <Modal open={d.metaOpen} onClose={() => d.setMetaOpen(false)} title="Данные автомобиля">
        <form className="service-book-meta-form" onSubmit={(e) => void d.handleSaveMeta(e)}>
          <FormField label="Госномер" htmlFor="vehicle-plate-edit">
            <Input
              id="vehicle-plate-edit"
              value={d.plateDraft}
              onChange={(e) => d.setPlateDraft(e.target.value.toUpperCase())}
              placeholder="А123ВС777"
              spellCheck={false}
            />
          </FormField>
          <FormField label="Цвет" htmlFor="vehicle-color-edit">
            <Input
              id="vehicle-color-edit"
              value={d.colorDraft}
              onChange={(e) => d.setColorDraft(e.target.value)}
              placeholder="Белый"
            />
          </FormField>
          <FormField label="VIN" htmlFor="vehicle-vin-edit">
            <Input
              id="vehicle-vin-edit"
              value={d.vinDraft}
              onChange={(e) => d.setVinDraft(e.target.value.toUpperCase())}
              placeholder="XTA211440Y0123456"
              spellCheck={false}
            />
          </FormField>
          <div className="service-book-meta-form-actions">
            <Button type="button" variant="secondary" onClick={() => d.setMetaOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={d.savingMeta}>
              {d.savingMeta ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={d.addOpen}
        onClose={() => d.setAddOpen(false)}
        title="Добавить работу"
        className="modal-service-record"
      >
        <form className="service-record-form" onSubmit={(e) => void d.handleAdd(e)}>
          <p className="service-record-form-lead">
            Запись попадёт в сервисную книжку
            {d.category === 'oil_change' ? ' и обновит план замены масла' : ''}.
          </p>

          <div
            className={`service-record-preview${d.title.trim() || d.performedAt ? ' is-ready' : ''}`}
            aria-live="polite"
          >
            <span className="service-record-preview-icon" aria-hidden>
              {d.category === 'oil_change' ? <Droplets size={18} /> : <Wrench size={18} />}
            </span>
            <div className="service-record-preview-body">
              <strong>{d.title.trim() || categoryTitle(d.category)}</strong>
              <span>
                {[
                  d.performedAt ? new Date(d.performedAt).toLocaleDateString('ru-RU') : null,
                  d.mileageKm.trim() ? `${Number(d.mileageKm).toLocaleString('ru-RU')} км` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Укажите дату и пробег'}
              </span>
            </div>
          </div>

          <fieldset className="service-record-cats">
            <legend className="service-record-cats-label">Тип работ</legend>
            <div className="service-record-cat-chips" role="group" aria-label="Тип работ">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`service-record-cat-chip${d.category === opt.id ? ' is-active' : ''}`}
                  aria-pressed={d.category === opt.id}
                  onClick={() => d.selectCategory(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="service-record-form-grid service-record-form-grid-primary">
            <FormField label="Дата" htmlFor="sr-date">
              <Input
                id="sr-date"
                type="date"
                value={d.performedAt}
                onChange={(e) => d.setPerformedAt(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Пробег, км" htmlFor="sr-mileage">
              <Input
                id="sr-mileage"
                type="number"
                min={0}
                value={d.mileageKm}
                onChange={(e) => d.setMileageKm(e.target.value)}
                placeholder={vehicle.currentMileageKm != null ? String(vehicle.currentMileageKm) : '45000'}
              />
            </FormField>
          </div>

          <FormField label="Комментарий" htmlFor="sr-works" hint="необязательно">
            <textarea
              id="sr-works"
              className="textarea service-record-note-input"
              value={d.worksDone}
              onChange={(e) => d.setWorksDone(e.target.value)}
              rows={3}
              placeholder={d.category === 'oil_change' ? 'Масло 5W-40, фильтр масляный' : 'Что сделали'}
            />
          </FormField>

          <button
            type="button"
            className={`service-record-details-toggle${d.detailsOpen ? ' is-open' : ''}`}
            aria-expanded={d.detailsOpen}
            aria-controls="service-record-extra-fields"
            onClick={() => d.setDetailsOpen((v) => !v)}
          >
            <span className="service-record-details-toggle-copy">
              <strong>Дополнительно</strong>
              <small>{d.extraDetailsHint}</small>
            </span>
            <ChevronDown size={18} className="service-record-details-toggle-chevron" aria-hidden />
          </button>

          {d.detailsOpen ? (
            <div className="service-record-details" id="service-record-extra-fields">
              <FormField label="Название" htmlFor="sr-title">
                <Input
                  id="sr-title"
                  value={d.title}
                  onChange={(e) => {
                    d.setTitle(e.target.value);
                    d.setTitleCustomized(true);
                  }}
                />
              </FormField>
              <div className="service-record-form-grid">
                <FormField label="№ заказ-наряда" htmlFor="sr-wo">
                  <Input
                    id="sr-wo"
                    value={d.workOrderNumber}
                    onChange={(e) => d.setWorkOrderNumber(e.target.value)}
                    placeholder="ЗН-0042"
                  />
                </FormField>
                <FormField label="Сумма, ₽" htmlFor="sr-amount">
                  <Input
                    id="sr-amount"
                    type="number"
                    min={0}
                    value={d.amountRub}
                    onChange={(e) => d.setAmountRub(e.target.value)}
                    placeholder="8500"
                  />
                </FormField>
              </div>
            </div>
          ) : null}

          <div className="service-record-form-actions">
            <Button type="button" variant="secondary" onClick={() => d.setAddOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={d.saving}>
              {d.saving ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(d.deleteId)}
        title="Удалить запись?"
        text="Запись будет удалена из сервисной книжки."
        onConfirm={() => void d.handleDelete()}
        onCancel={() => d.setDeleteId(null)}
      />
    </>
  );
}
