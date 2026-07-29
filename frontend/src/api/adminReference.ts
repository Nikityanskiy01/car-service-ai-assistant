import { api } from './client';

export type ServiceCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
};

export type ConsultationQuestion = {
  id: string;
  scenarioId: string;
  order: number;
  text: string;
};

export type ConsultationHint = {
  id: string;
  scenarioId: string | null;
  order: number;
  text: string;
};

export type ConsultationScenario = {
  id: string;
  title: string;
  description?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  questions?: ConsultationQuestion[];
  hints?: ConsultationHint[];
};

export type ReferenceMaterial = {
  id: string;
  title: string;
  body: string;
  categoryId?: string | null;
  category?: ServiceCategory | null;
  createdAt: string;
  updatedAt: string;
};

export function listServiceCategories() {
  return api<ServiceCategory[]>('/admin/reference/service-categories');
}

export function createServiceCategory(body: { name: string; description?: string }) {
  return api<ServiceCategory>('/admin/reference/service-categories', { method: 'POST', body });
}

export function updateServiceCategory(id: string, body: { name?: string; description?: string | null }) {
  return api<ServiceCategory>(`/admin/reference/service-categories/${id}`, { method: 'PATCH', body });
}

export function deleteServiceCategory(id: string) {
  return api<void>(`/admin/reference/service-categories/${id}`, { method: 'DELETE' });
}

export function listScenarios() {
  return api<ConsultationScenario[]>('/admin/reference/scenarios');
}

export function createScenario(body: { title: string; description?: string }) {
  return api<ConsultationScenario>('/admin/reference/scenarios', { method: 'POST', body });
}

export function updateScenario(
  id: string,
  body: { title?: string; description?: string | null; active?: boolean },
) {
  return api<ConsultationScenario>(`/admin/reference/scenarios/${id}`, { method: 'PATCH', body });
}

export function deleteScenario(id: string) {
  return api<void>(`/admin/reference/scenarios/${id}`, { method: 'DELETE' });
}

export function listScenarioQuestions(scenarioId: string) {
  return api<ConsultationQuestion[]>(`/admin/reference/scenarios/${scenarioId}/questions`);
}

export function createScenarioQuestion(scenarioId: string, body: { text: string; order?: number }) {
  return api<ConsultationQuestion>(`/admin/reference/scenarios/${scenarioId}/questions`, {
    method: 'POST',
    body,
  });
}

export function updateScenarioQuestion(id: string, body: { text?: string; order?: number }) {
  return api<ConsultationQuestion>(`/admin/reference/questions/${id}`, { method: 'PATCH', body });
}

export function deleteScenarioQuestion(id: string) {
  return api<void>(`/admin/reference/questions/${id}`, { method: 'DELETE' });
}

export function listScenarioHints(scenarioId: string) {
  return api<ConsultationHint[]>(`/admin/reference/scenarios/${scenarioId}/hints`);
}

export function createScenarioHint(scenarioId: string, body: { text: string; order?: number }) {
  return api<ConsultationHint>(`/admin/reference/scenarios/${scenarioId}/hints`, { method: 'POST', body });
}

export function updateScenarioHint(
  id: string,
  body: { text?: string; order?: number; scenarioId?: string | null },
) {
  return api<ConsultationHint>(`/admin/reference/hints/${id}`, { method: 'PATCH', body });
}

export function deleteScenarioHint(id: string) {
  return api<void>(`/admin/reference/hints/${id}`, { method: 'DELETE' });
}

export function listReferenceMaterials() {
  return api<ReferenceMaterial[]>('/admin/reference/reference-materials');
}

export function createReferenceMaterial(body: {
  title: string;
  body: string;
  categoryId?: string | null;
}) {
  return api<ReferenceMaterial>('/admin/reference/reference-materials', { method: 'POST', body });
}

export function updateReferenceMaterial(
  id: string,
  body: { title?: string; body?: string; categoryId?: string | null },
) {
  return api<ReferenceMaterial>(`/admin/reference/reference-materials/${id}`, { method: 'PATCH', body });
}

export function deleteReferenceMaterial(id: string) {
  return api<void>(`/admin/reference/reference-materials/${id}`, { method: 'DELETE' });
}
