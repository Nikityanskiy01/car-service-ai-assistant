/**
 * Заявки: создание из консультации, список, статусы, досье, CRM.
 * Реализация в service/*; этот модуль — публичный фасад.
 */

export { createFromSession, createFromGuestSession } from './service/create.js';
export { listRequests, listBoard } from './service/list.js';
export { getRequest, getStatusHistory, getSimilarCasesForRequest } from './service/read.js';
export {
  patchRequestStatus,
  assignRequestToManager,
  assignRequestToManagerId,
  listStaffManagers,
  bulkPatchStatuses,
  bulkAssignToManager,
} from './service/mutate.js';
export { getClientDossier, getGuestDossier, listClients } from './service/dossiers.js';
export { listActivity, bulkExportToCrm } from './service/ops.js';
export { isSlaBreached } from '../../lib/requestSla.js';
