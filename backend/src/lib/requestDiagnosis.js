export function getDiagnosisFromSession(session) {
  if (!session?.flowState || typeof session.flowState !== 'object' || Array.isArray(session.flowState)) {
    return null;
  }
  return session.flowState.diagnosis || null;
}

export function getUrgencyFromRequest(row) {
  const diagnosis = getDiagnosisFromSession(row.consultationSession);
  return diagnosis?.urgency ? String(diagnosis.urgency).toLowerCase() : null;
}
