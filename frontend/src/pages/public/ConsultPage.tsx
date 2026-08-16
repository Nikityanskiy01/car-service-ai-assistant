import { useProductConfig } from '../../config/ProductConfigProvider';
import { ConsultChrome } from '../../features/consultations/consultPage/ConsultChrome';
import { ConsultContactModal } from '../../features/consultations/consultPage/ConsultContactModal';
import { ConsultWorkspace } from '../../features/consultations/consultPage/ConsultWorkspace';
import { useConsultPage } from '../../features/consultations/useConsultPage';
import { usePageMeta } from '../../hooks/usePageMeta';

export function ConsultPage() {
  const productConfig = useProductConfig();
  usePageMeta({
    title: 'Интеллектуальная диагностика',
    description: 'Чат-диагностика симптомов до записи в автосервис.',
  });
  const page = useConsultPage();

  return (
    <div className="fm-page consultation-page">
      <ConsultChrome page={page} assistantName={productConfig.assistantName} />
      <ConsultWorkspace page={page} assistantName={productConfig.assistantName} />
      <ConsultContactModal page={page} />
    </div>
  );
}
