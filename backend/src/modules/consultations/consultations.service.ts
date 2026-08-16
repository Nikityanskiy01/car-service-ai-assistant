/**
 * Консультации: сессии, сообщения, отчёты, фото.
 * Реализация в service/*; этот модуль — публичный фасад.
 */

export {
  createSessionForClient,
  createGuestSession,
  bootstrapOpeningTurn,
  claimSession,
  listSessions,
  listSessionsForStaff,
  getSessionDetail,
} from './service/sessions.js';
export { postMessage, finalizeDiagnosisForSession } from './service/messages.js';
export { saveReport, listMyReports } from './service/reports.js';
export { analyzeConsultationPhoto } from './service/photo.js';
