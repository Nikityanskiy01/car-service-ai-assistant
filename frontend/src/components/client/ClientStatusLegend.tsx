import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';
import {
  CLIENT_BOOKING_STATUS_LEGEND,
  CLIENT_REQUEST_STATUS_LEGEND,
  type ClientStatusLegendItem,
} from '../../lib/clientStatusLegend';

function LegendGroup({
  title,
  items,
}: {
  title: string;
  items: ClientStatusLegendItem[];
}) {
  return (
    <div className="client-status-legend-group">
      <h3>{title}</h3>
      <ul className="client-status-legend-list">
        {items.map((item) => (
          <li key={item.status}>
            <StatusBadge status={item.status} />
            <div>
              <strong>{item.label}</strong>
              <p>{item.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ClientStatusLegend({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <details className="client-status-legend client-status-legend-compact">
        <summary>Что означают статусы?</summary>
        <div className="client-status-legend-body">
          <LegendGroup title="Обращения" items={CLIENT_REQUEST_STATUS_LEGEND} />
          <LegendGroup title="Записи" items={CLIENT_BOOKING_STATUS_LEGEND} />
        </div>
      </details>
    );
  }

  return (
    <Card className="client-status-legend">
      <h2>Легенда статусов</h2>
      <div className="client-status-legend-body">
        <LegendGroup title="Обращения" items={CLIENT_REQUEST_STATUS_LEGEND} />
        <LegendGroup title="Записи" items={CLIENT_BOOKING_STATUS_LEGEND} />
      </div>
    </Card>
  );
}
