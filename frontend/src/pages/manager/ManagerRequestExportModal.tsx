import { Button } from '../../components/console/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/console/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/console/ui/sheet';
import { formatRequestNumber } from '../../lib/labels';
import type { LoadedManagerRequest } from './useManagerRequestDetail';

export function ManagerRequestExportModal({ d }: { d: LoadedManagerRequest }) {
  const { request } = d;

  return (
    <Sheet open={d.exportOpen} onOpenChange={(open) => !open && d.setExportOpen(false)}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Передать в учётную систему</SheetTitle>
          <SheetDescription>
            Заявка №{formatRequestNumber(request.id)}, клиент {d.owner}, {d.car}.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-6">
          {d.exportableConnections.length > 1 ? (
            <label className="flex flex-col gap-1 text-sm">
              Подключение
              <Select value={d.exportConnectionId || undefined} onValueChange={d.setExportConnectionId}>
                <SelectTrigger aria-label="Подключение учётной системы">
                  <SelectValue placeholder="Выберите систему" />
                </SelectTrigger>
                <SelectContent>
                  {d.exportableConnections.map((connection) => (
                    <SelectItem key={connection.id} value={connection.id}>
                      {connection.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          ) : (
            <p className="text-sm text-muted-foreground">Получатель: {d.exportableConnections[0]?.name}</p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => d.setExportOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              disabled={!d.exportConnectionId || d.exportBusy}
              onClick={() => void d.handleExport()}
            >
              {d.exportBusy
                ? 'Отправляем…'
                : `Передать${d.selectedExportConnection ? ` в ${d.selectedExportConnection.name}` : ''}`}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
