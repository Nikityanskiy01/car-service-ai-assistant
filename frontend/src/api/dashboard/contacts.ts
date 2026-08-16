import { api } from '../client';
import type { ContactSubmission } from '../../types/dashboard';

export function listContacts(status?: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return api<ContactSubmission[]>(`/contact${qs}`);
}

export function patchContactStatus(
  contactId: string,
  body: { status: 'NEW' | 'IN_PROGRESS' | 'CLOSED'; closedReason?: string },
) {
  return api<ContactSubmission>(`/contact/${contactId}`, { method: 'PATCH', body });
}

export function convertContactToRequest(contactId: string) {
  return api<{ requestId: string; alreadyConverted?: boolean }>(`/contact/${contactId}/convert-to-request`, {
    method: 'POST',
    body: {},
  });
}
