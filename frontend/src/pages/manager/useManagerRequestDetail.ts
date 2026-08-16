import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  exportRequestToCrm,
  getRequestIntegrations,
  listManagerIntegrations,
  retryRequestIntegration,
} from '../../api/integrations';
import {
  assignRequestToMe,
  assignRequestToManager,
  getRequestStatusHistory,
  getServiceRequest,
  listRequestMessages,
  patchServiceRequestStatus,
  sendRequestMessage,
  type StatusHistoryItem,
} from '../../api/dashboard';
import { ApiError } from '../../api/errors';
import { prefillBookingFromConsultation } from '../../features/services/prefill';
import {
  getRequestConfidence,
  getRequestUrgency,
  getSessionDiagnosis,
} from '../../lib/managerRequestHelpers';
import type { PendingAttachment } from '../../components/requests/MessageAttachmentInput';
import { toast } from '../../lib/toast';
import { managerZonePaths } from '../../config/managerPaths';
import { SERVICE_REQUEST_STATUS_LABELS } from '../../lib/labels';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { RequestIntegrationStatus } from '../../types/integration';
import type { IntegrationConnection } from '../../types/integration';
import type { ServiceRequestDetail, ServiceRequestStatus } from '../../types/serviceRequest';
import type { FollowUpMessage } from '../../api/dashboard';
import type { ConsultationDetail } from '../../types/consultation';

export const MANAGER_REQUEST_TABS = [
  { id: 'summary', label: 'Сводка' },
  { id: 'consultation', label: 'Диалог ИИ' },
  { id: 'messages', label: 'Переписка' },
  { id: 'works', label: 'Работы и оценка' },
  { id: 'history', label: 'История и CRM' },
];

export function useManagerRequestDetail(adminZone = false) {
  const { requestId = '' } = useParams();
  const navigate = useNavigate();
  const paths = managerZonePaths(adminZone);
  const { success, error: toastError } = { success: toast.success, error: toast.error };
  usePageMeta({ title: 'Заявка', description: 'Подробная карточка обращения.' });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<ServiceRequestDetail | null>(null);
  const [messages, setMessages] = useState<FollowUpMessage[]>([]);
  const [integrations, setIntegrations] = useState<RequestIntegrationStatus | null>(null);
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [tab, setTab] = useState('summary');
  const [reply, setReply] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [assignManagerId, setAssignManagerId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [sending, setSending] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportConnectionId, setExportConnectionId] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);

  const load = useCallback(async (silent = false) => {
    if (!requestId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [detail, msgs, integ] = await Promise.all([
        getServiceRequest(requestId),
        listRequestMessages(requestId).catch(() => []),
        getRequestIntegrations(requestId).catch(() => ({ links: [], jobs: [] })),
      ]);
      setRequest(detail);
      setMessages(msgs);
      setIntegrations(integ);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить заявку');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void listManagerIntegrations()
      .then((rows) =>
        setConnections(
          rows.map((connection) => ({
            ...connection,
            capabilities: connection.capabilities || { pushRequests: true },
          })) as IntegrationConnection[],
        ),
      )
      .catch(() => setConnections([]));
  }, []);

  useEffect(() => {
    if (tab !== 'history' || !requestId) return;
    void getRequestStatusHistory(requestId)
      .then((data) => setStatusHistory(data.items))
      .catch(() => setStatusHistory([]));
  }, [tab, requestId]);

  const owner = request?.client?.fullName || request?.guestName || 'Гость';
  const phone = request?.client?.phone || request?.guestPhone || '';
  const car = `${request?.snapshotMake || ''} ${request?.snapshotModel || ''}`.trim() || 'Не указан';
  const session = request?.consultationSession;
  const diagnosis = getSessionDiagnosis(session);
  const confidence = getRequestConfidence(session);
  const urgency = getRequestUrgency(session);

  const exportableConnections = useMemo(
    () => connections.filter((connection) => connection.capabilities?.pushRequests),
    [connections],
  );
  const threadClosed = request?.status === 'COMPLETED' || request?.status === 'CANCELLED';
  const selectedExportConnection = exportableConnections.find(
    (connection) => connection.id === exportConnectionId,
  );

  function openBooking() {
    if (!request) return;
    prefillBookingFromConsultation({
      detail: {
        extracted: session?.extracted,
        diagnosis: diagnosis || undefined,
      } as ConsultationDetail,
      serviceRequestId: request.id,
      fullName: owner,
      phone: phone || undefined,
    });
    void navigate('/booking');
  }

  async function changeStatus(status: ServiceRequestStatus) {
    if (!request) return;
    setActionError(null);
    const previousStatus = request.status;
    try {
      const updated = await patchServiceRequestStatus(request.id, status, request.version);
      setRequest({ ...request, status: updated.status, version: updated.version });
      success(`Статус: ${SERVICE_REQUEST_STATUS_LABELS[updated.status]}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const fresh = await getServiceRequest(request.id);
        setRequest(fresh);
        setActionError(
          `Заявку уже изменил другой сотрудник. Вы выбирали «${SERVICE_REQUEST_STATUS_LABELS[status]}», сейчас в системе «${SERVICE_REQUEST_STATUS_LABELS[fresh.status]}» (было «${SERVICE_REQUEST_STATUS_LABELS[previousStatus]}»). Проверьте и повторите.`,
        );
        toastError('Конфликт версий: данные обновлены');
        return;
      }
      const message = e instanceof Error ? e.message : 'Не удалось изменить статус';
      setActionError(message);
      toastError(message);
      await load(true);
    }
  }

  async function submitReply() {
    if (!request || (!reply.trim() && !pendingAttachments.length)) return;
    setSending(true);
    setActionError(null);
    try {
      const message = await sendRequestMessage(request.id, {
        body: reply.trim(),
        attachments: pendingAttachments.map(({ fileName, mimeType, contentBase64 }) => ({
          fileName,
          mimeType,
          contentBase64,
        })),
      });
      setMessages((prev) => [...prev, message]);
      setReply('');
      setPendingAttachments([]);
      success('Сообщение отправлено клиенту');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось отправить сообщение';
      setActionError(message);
      toastError(message);
    } finally {
      setSending(false);
    }
  }

  async function handleAssignToMe() {
    if (!request) return;
    setAssigning(true);
    setActionError(null);
    try {
      await assignRequestToMe(request.id);
      await load(true);
      success('Заявка назначена на вас');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось назначить заявку';
      setActionError(message);
      toastError(message);
    } finally {
      setAssigning(false);
    }
  }

  async function handleAssignManager() {
    if (!request || !assignManagerId) return;
    setAssigning(true);
    setActionError(null);
    try {
      const updated = await assignRequestToManager(request.id, assignManagerId);
      setRequest({
        ...request,
        assignedManagerId: updated.assignedManagerId,
        assignedManager: updated.assignedManager || request.assignedManager,
        version: updated.version,
      });
      setAssignManagerId('');
      success(`Ответственный: ${updated.assignedManager?.fullName || 'обновлён'}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось назначить менеджера';
      setActionError(message);
      toastError(message);
    } finally {
      setAssigning(false);
    }
  }

  async function handleExport() {
    if (!request || !exportConnectionId) return;
    setExportBusy(true);
    setActionError(null);
    try {
      const out = await exportRequestToCrm(request.id, exportConnectionId);
      setIntegrations(out);
      setExportOpen(false);
      success('Заявка отправлена в учётную систему');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось передать заявку';
      setActionError(message);
      toastError(message);
    } finally {
      setExportBusy(false);
    }
  }

  async function handleRetry(connectionId: string) {
    if (!request) return;
    setActionError(null);
    try {
      const out = await retryRequestIntegration(request.id, connectionId);
      setIntegrations(out);
      success('Повторная отправка поставлена в очередь');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Повтор не удался';
      setActionError(message);
      toastError(message);
    }
  }

  return {
    adminZone,
    paths,
    loading,
    error,
    request,
    setRequest,
    messages,
    integrations,
    connections,
    tab,
    setTab,
    reply,
    setReply,
    pendingAttachments,
    setPendingAttachments,
    assignManagerId,
    setAssignManagerId,
    assigning,
    sending,
    exportOpen,
    setExportOpen,
    exportBusy,
    exportConnectionId,
    setExportConnectionId,
    actionError,
    setActionError,
    statusHistory,
    load,
    owner,
    phone,
    car,
    session,
    diagnosis,
    confidence,
    urgency,
    exportableConnections,
    threadClosed,
    selectedExportConnection,
    openBooking,
    changeStatus,
    submitReply,
    handleAssignToMe,
    handleAssignManager,
    handleExport,
    handleRetry,
  };
}

export type ManagerRequestDetailState = ReturnType<typeof useManagerRequestDetail>;
export type LoadedManagerRequest = ManagerRequestDetailState & { request: ServiceRequestDetail };
