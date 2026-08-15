import { Link } from 'react-router-dom';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Loader } from '../../../components/ui/Loader';
import { VehicleDetailDialogs } from './VehicleDetailDialogs';
import { VehicleHistorySection } from './VehicleHistorySection';
import { VehicleIdentitySection } from './VehicleIdentitySection';
import { VehicleOilPlanSection } from './VehicleOilPlanSection';
import { useClientVehicleDetail, type LoadedVehicleDetail } from './useClientVehicleDetail';

export function ClientVehicleDetailPage() {
  const d = useClientVehicleDetail();

  if (d.loading) return <Loader label="Загружаем сервисную книжку…" />;
  if (!d.vehicle) {
    return (
      <EmptyState
        title="Автомобиль не найден"
        description={d.error || 'Вернитесь в гараж и выберите машину.'}
        action={
          <Link to="/dashboard/client/vehicles" className="btn btn-primary">
            К гаражу
          </Link>
        }
      />
    );
  }

  const loaded = d as LoadedVehicleDetail;

  return (
    <div className="service-book stack">
      <VehicleIdentitySection d={loaded} />
      <VehicleOilPlanSection d={loaded} />
      <VehicleHistorySection d={loaded} />
      <VehicleDetailDialogs d={loaded} />
    </div>
  );
}
