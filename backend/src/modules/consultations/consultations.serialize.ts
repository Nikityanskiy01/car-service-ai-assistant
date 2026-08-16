export function serializeSession(s, { isGuest }: { isGuest?: boolean } = {}) {
  const guest = isGuest ?? s.clientId == null;
  return {
    id: s.id,
    status: s.status,
    vehicleId: s.vehicleId ?? null,
    progressPercent: s.progressPercent,
    confidencePercent: s.confidencePercent,
    costFromMinor: s.costFromMinor,
    preliminaryNote: s.preliminaryNote,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    serviceCategoryId: s.serviceCategoryId,
    isGuest: guest,
    guestName: s.guestName || null,
    guestPhone: s.guestPhone || null,
  };
}

export function serializeSessionList(s) {
  const flow =
    s.flowState && typeof s.flowState === 'object' && !Array.isArray(s.flowState) ? s.flowState : {};
  return {
    ...serializeSession(s),
    make: s.extracted?.make ?? null,
    model: s.extracted?.model ?? null,
    symptoms: s.extracted?.symptoms ?? null,
    extracted: s.extracted,
    serviceRequest: s.serviceRequest,
    intent: flow.intent ?? null,
    serviceType: flow.service_type ?? null,
    serviceCategoryName: s.serviceCategory?.name ?? null,
  };
}

export function serializeStaffSessionList(s) {
  return {
    id: s.id,
    status: s.status,
    progressPercent: s.progressPercent,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
    client: s.client
      ? {
          id: s.client.id,
          fullName: s.client.fullName,
          phone: s.client.phone,
          email: s.client.emailProfile || s.client.email,
        }
      : null,
    guestName: s.guestName || null,
    guestPhone: s.guestPhone || null,
    make: s.extracted?.make ?? null,
    model: s.extracted?.model ?? null,
    serviceRequest: s.serviceRequest,
    serviceCategoryName: s.serviceCategory?.name ?? null,
  };
}

export function serializeSessionDetail(s) {
  const diagnosisSnapshot =
    s?.flowState && typeof s.flowState === 'object' && !Array.isArray(s.flowState)
      ? s.flowState.diagnosis || null
      : null;
  return {
    ...serializeSession(s),
    flowState: s.flowState ?? null,
    diagnosis: diagnosisSnapshot,
    client: s.client
      ? {
          id: s.client.id,
          fullName: s.client.fullName,
          phone: s.client.phone,
          email: s.client.emailProfile || s.client.email,
        }
      : undefined,
    extracted: s.extracted,
    recommendations: s.recommendations,
    messages: s.messages?.map((m) => ({
      id: m.id,
      sender: m.sender,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    serviceRequest: s.serviceRequest,
    serviceCategory: s.serviceCategory,
    diagnosisJob: s.diagnosisJob
      ? {
          id: s.diagnosisJob.id,
          status: s.diagnosisJob.status,
          errorMessage: s.diagnosisJob.errorMessage,
          updatedAt: s.diagnosisJob.updatedAt.toISOString(),
        }
      : null,
  };
}

export function serializeServiceRequest(sr) {
  return {
    id: sr.id,
    status: sr.status,
    version: sr.version,
    clientId: sr.clientId,
    consultationSessionId: sr.consultationSessionId,
    snapshotMake: sr.snapshotMake,
    snapshotModel: sr.snapshotModel,
    snapshotSymptoms: sr.snapshotSymptoms,
    createdAt: sr.createdAt.toISOString(),
    client: sr.client
      ? {
          id: sr.client.id,
          fullName: sr.client.fullName,
          phone: sr.client.phone,
          email: sr.client.email,
          emailProfile: sr.client.emailProfile,
        }
      : undefined,
    consultationSession: sr.consultationSession,
  };
}
