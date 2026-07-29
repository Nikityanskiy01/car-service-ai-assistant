export function toCanonicalCustomer(serviceRequest) {
  const client = serviceRequest?.client || null;
  const guestName = serviceRequest?.guestName || null;
  const guestPhone = serviceRequest?.guestPhone || null;
  return {
    internalId: client?.id || `guest:${serviceRequest.id}`,
    type: 'INDIVIDUAL',
    name: client?.fullName || guestName || 'Клиент',
    phone: client?.phone || guestPhone || null,
    email: client?.emailProfile || client?.email || serviceRequest?.guestEmail || null,
    externalIds: {},
    consentToPersonalData: true,
    consentToMarketing: null,
    comment: null,
    createdAt: serviceRequest?.createdAt?.toISOString?.() || new Date().toISOString(),
    updatedAt: serviceRequest?.updatedAt?.toISOString?.() || new Date().toISOString(),
  };
}

export function toCanonicalVehicle(serviceRequest) {
  const session = serviceRequest?.consultationSession || null;
  const ex = session?.extracted || null;
  return {
    internalId: `vehicle:${serviceRequest.id}`,
    customerInternalId: serviceRequest?.client?.id || null,
    brand: ex?.make || serviceRequest?.snapshotMake || null,
    model: ex?.model || serviceRequest?.snapshotModel || null,
    year: ex?.year ?? null,
    vin: null,
    registrationNumber: null,
    mileageKm: ex?.mileage ?? null,
    engine: null,
    comment: null,
    externalIds: {},
    createdAt: serviceRequest?.createdAt?.toISOString?.() || new Date().toISOString(),
    updatedAt: serviceRequest?.updatedAt?.toISOString?.() || new Date().toISOString(),
  };
}

export function toCanonicalServiceRequest(serviceRequest) {
  const session = serviceRequest?.consultationSession || null;
  const diagnosis = session?.flowState?.diagnosis || null;
  const recommendations = Array.isArray(session?.recommendations) ? session.recommendations : [];
  return {
    internalId: serviceRequest.id,
    number: serviceRequest.id.slice(0, 8).toUpperCase(),
    customer: toCanonicalCustomer(serviceRequest),
    vehicle: toCanonicalVehicle(serviceRequest),
    symptoms: String(serviceRequest.snapshotSymptoms || session?.extracted?.symptoms || '').trim(),
    consultationSummary: diagnosis?.summary ? String(diagnosis.summary) : null,
    possibleCauses: recommendations.map((x) => String(x.title || '')).filter(Boolean).slice(0, 5),
    recommendedChecks: Array.isArray(diagnosis?.recommended_checks)
      ? diagnosis.recommended_checks.map((x) => String(x || '')).filter(Boolean).slice(0, 8)
      : [],
    urgency: String(diagnosis?.urgency || 'MEDIUM').toUpperCase(),
    confidence: Number.isFinite(Number(diagnosis?.confidence)) ? Number(diagnosis.confidence) : null,
    estimatedPriceFrom: Number.isFinite(Number(diagnosis?.estimated_cost_from)) ? Number(diagnosis.estimated_cost_from) : null,
    currency: 'RUB',
    internalStatus: serviceRequest.status,
    assignedManagerId: null,
    createdAt: serviceRequest.createdAt.toISOString(),
    updatedAt: serviceRequest.updatedAt.toISOString(),
  };
}
