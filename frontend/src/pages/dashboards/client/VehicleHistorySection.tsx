import { Download, Droplets, FileImage, MoreHorizontal, Plus, Trash2, Wrench } from 'lucide-react';
import { downloadApiFile } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { categoryLabel, formatMoney, recordsCountLabel } from './vehicleDetailLabels';
import type { LoadedVehicleDetail } from './useClientVehicleDetail';

export function VehicleHistorySection({ d }: { d: LoadedVehicleDetail }) {
  const { records } = d;

  return (
    <section className="service-book-history" aria-label="История работ">
      <header className="service-book-history-header">
        <div>
          <h2>История работ</h2>
          <p className="muted">{recordsCountLabel(records.length)}</p>
        </div>
        <Button type="button" onClick={() => d.openAddModal()}>
          <Plus size={16} aria-hidden />
          Добавить
        </Button>
      </header>

      {records.length === 0 ? (
        <EmptyState
          title="История пуста"
          description="Добавьте выполненные работы вручную или дождитесь закрытия ремонта в сервисе."
          action={
            <Button type="button" onClick={() => d.openAddModal()}>
              Добавить работу
            </Button>
          }
        />
      ) : (
        <ul className="service-book-records">
          {records.map((record, index) => {
            const day = new Date(record.performedAt);
            const isFirst = index === 0;
            return (
              <li key={record.id} className={`service-book-record${isFirst ? ' is-latest' : ''}`}>
                <div className="service-book-record-rail" aria-hidden>
                  <span className="service-book-record-dot" />
                </div>
                <div className="service-book-record-card">
                  <div className="service-book-record-top">
                    <div className="service-book-record-when">
                      <time dateTime={record.performedAt}>
                        {day.toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </time>
                      {record.mileageKm != null ? (
                        <span>{record.mileageKm.toLocaleString('ru-RU')} км</span>
                      ) : null}
                      <span className="service-book-record-cat">{categoryLabel(String(record.category))}</span>
                    </div>
                    <details className="service-book-record-more">
                      <summary aria-label="Ещё действия">
                        <MoreHorizontal size={16} aria-hidden />
                      </summary>
                      <div className="service-book-record-more-menu">
                        <button
                          type="button"
                          onClick={() =>
                            void downloadApiFile(
                              `/api/service-records/${record.id}/export.pdf`,
                              `service-record-${record.id.slice(0, 8)}.pdf`,
                            )
                          }
                        >
                          <Download size={14} aria-hidden />
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void downloadApiFile(
                              `/api/service-records/${record.id}/export.jpg`,
                              `service-record-${record.id.slice(0, 8)}.jpg`,
                            )
                          }
                        >
                          <FileImage size={14} aria-hidden />
                          JPEG
                        </button>
                        {record.source === 'client_manual' ? (
                          <button type="button" onClick={() => d.setDeleteId(record.id)}>
                            <Trash2 size={14} aria-hidden />
                            Удалить
                          </button>
                        ) : null}
                      </div>
                    </details>
                  </div>

                  <div className="service-book-record-main">
                    <span className="service-book-record-icon" aria-hidden>
                      {record.category === 'oil_change' ? <Droplets size={16} /> : <Wrench size={16} />}
                    </span>
                    <div className="service-book-record-titles">
                      <strong>{record.title}</strong>
                      <div className="service-book-record-meta">
                        {record.workOrderNumber ? <span>ЗН {record.workOrderNumber}</span> : null}
                        {formatMoney(record.amountMinor) ? <span>{formatMoney(record.amountMinor)}</span> : null}
                        <span>{record.source === 'manager_feedback' ? 'Сервис' : 'Вручную'}</span>
                      </div>
                      {record.worksDone ? <p className="service-book-record-note">{record.worksDone}</p> : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
