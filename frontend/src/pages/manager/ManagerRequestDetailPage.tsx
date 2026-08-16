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
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-48 w-full" />
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
    <div className="flex flex-col gap-4">
      <ManagerRequestChrome d={loaded} />
      <Tabs value={d.tab} onValueChange={d.setTab} className="gap-3">
        <TabsList>
          {MANAGER_REQUEST_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
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
