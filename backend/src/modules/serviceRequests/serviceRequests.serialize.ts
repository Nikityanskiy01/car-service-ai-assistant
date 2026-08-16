import { isSlaBreached } from '../../lib/requestSla.js';
import { serializeExtracted } from './service/helpers.js';

export function serializeListItem(r) {
  const flowState = r.consultationSession?.flowState;
  const flow =
    flowState && typeof flowState === 'object' && !Array.isArray(flowState) ? flowState : {};
  const diagnosis = flow.diagnosis ?? null;

  return {
    id: r.id,
    status: r.status,
    version: r.version,
    clientId: r.clientId,
    guestName: r.guestName,
    guestPhone: r.guestPhone,
    createdAt: r.createdAt.toISOString(),
    snapshotMake: r.snapshotMake,
    snapshotModel: r.snapshotModel,
    snapshotSymptoms: r.snapshotSymptoms,
    vehicleId: r.vehicleId ?? null,
    client: r.client,
    assignedManagerId: r.assignedManagerId,
    assignedManager: r.assignedManager,
    firstResponseAt: r.firstResponseAt?.toISOString?.() ?? null,
    slaBreached: isSlaBreached({ ...r, createdAt: r.createdAt.toISOString() }),
    consultationSession: r.consultationSession
      ? {
          id: r.consultationSession.id,
          status: r.consultationSession.status,
          feedback: r.consultationSession.feedback
            ? {
                id: r.consultationSession.feedback.id,
                verdict: r.consultationSession.feedback.verdict,
              }
            : null,
          flowState: diagnosis ? { diagnosis } : null,
          intent: flow.intent ?? null,
          serviceType: flow.service_type ?? null,
          serviceCategoryName: r.consultationSession.serviceCategory?.name ?? null,
          confidencePercent: r.consultationSession.confidencePercent,
          diagnosis,
        }
      : undefined,
  };
}

export function serializeDetail(r) {
  const flowState = r.consultationSession?.flowState;
  const diagnosis =
    flowState && typeof flowState === 'object' && !Array.isArray(flowState) && flowState.diagnosis
      ? flowState.diagnosis
      : null;

  return {
    id: r.id,
    status: r.status,
    version: r.version,
    clientId: r.clientId,
    guestName: r.guestName,
    guestPhone: r.guestPhone,
    guestEmail: r.guestEmail,
    consultationSessionId: r.consultationSessionId,
    snapshotMake: r.snapshotMake,
    snapshotModel: r.snapshotModel,
    snapshotSymptoms: r.snapshotSymptoms,
    createdAt: r.createdAt.toISOString(),
    client: r.client,
    assignedManagerId: r.assignedManagerId,
    assignedManager: r.assignedManager,
    firstResponseAt: r.firstResponseAt?.toISOString?.() ?? null,
    slaBreached: isSlaBreached({ ...r, createdAt: r.createdAt.toISOString() }),
    consultationSession: r.consultationSession
      ? {
          id: r.consultationSession.id,
          status: r.consultationSession.status,
          progressPercent: r.consultationSession.progressPercent,
          flowState: flowState && typeof flowState === 'object' ? flowState : null,
          messages: r.consultationSession.messages?.map((m) => ({
            id: m.id,
            sender: m.sender,
            content: m.content,
            createdAt: m.createdAt.toISOString(),
          })),
          extracted: serializeExtracted(r.consultationSession.extracted),
          recommendations: r.consultationSession.recommendations,
          diagnosis,
          feedback: r.consultationSession.feedback
            ? {
                id: r.consultationSession.feedback.id,
                verdict: r.consultationSession.feedback.verdict,
                actualCause: r.consultationSession.feedback.actualCause,
                worksDone: r.consultationSession.feedback.worksDone,
                repairAmountMinor: r.consultationSession.feedback.repairAmountMinor,
                workOrderNumber: r.consultationSession.feedback.workOrderNumber,
                repairCompletedAt: r.consultationSession.feedback.repairCompletedAt?.toISOString?.() ?? null,
                createdAt: r.consultationSession.feedback.createdAt.toISOString(),
                updatedAt: r.consultationSession.feedback.updatedAt.toISOString(),
                manager: r.consultationSession.feedback.manager
                  ? {
                      id: r.consultationSession.feedback.manager.id,
                      fullName: r.consultationSession.feedback.manager.fullName,
                    }
                  : undefined,
              }
            : null,
        }
      : undefined,
    bookings: (r.bookings || []).map((b) => ({
      id: b.id,
      status: b.status,
      preferredAt: b.preferredAt.toISOString(),
      notes: b.notes,
    })),
  };
}
