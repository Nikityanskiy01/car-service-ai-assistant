import { Alert, AlertDescription, AlertTitle } from '../../components/console/ui/alert';
import { Button } from '../../components/console/ui/button';
import { Skeleton } from '../../components/console/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '../../components/console/ui/tabs';
import { ManagerRequestChrome } from './ManagerRequestChrome';
import { ManagerRequestExportModal } from './ManagerRequestExportModal';
import { ManagerRequestPanels } from './ManagerRequestPanels';
import {
  MANAGER_REQUEST_TABS,
  useManagerRequestDetail,
  type LoadedManagerRequest,
} from './useManagerRequestDetail';

type ManagerRequestDetailPageProps = {
  adminZone?: boolean;
};

export function ManagerRequestDetailPage({ adminZone = false }: ManagerRequestDetailPageProps) {
  const d = useManagerRequestDetail(adminZone);

  if (d.loading) {
    return (
      <div className="request-page" aria-busy="true">
        <Skeleton className="request-skel-mast" />
        <Skeleton className="request-skel-tabs" />
        <div className="request-summary-layout">
          <Skeleton className="request-skel-diag" />
          <Skeleton className="request-skel-side" />
        </div>
      </div>
    );
  }

  if (d.error || !d.request) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Не удалось открыть заявку</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>{d.error || 'Заявка не найдена'}</span>
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => void d.load()}>
            Повторить
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const loaded = d as LoadedManagerRequest;

  return (
    <div className="request-page">
      <ManagerRequestChrome d={loaded} />
      <Tabs value={d.tab} onValueChange={d.setTab} className="request-page-tabs">
        <TabsList className="request-page-tablist">
          {MANAGER_REQUEST_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="request-tab">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <ManagerRequestPanels d={loaded} />
      <ManagerRequestExportModal d={loaded} />
    </div>
  );
}
