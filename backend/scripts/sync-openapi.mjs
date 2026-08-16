#!/usr/bin/env node
/**
 * Синхронизация OpenAPI с инвентарём Express-маршрутов.
 *   node backend/scripts/sync-openapi.mjs           # записать yaml
 *   node backend/scripts/sync-openapi.mjs --check   # drift vs inventory
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const inventoryPath = join(root, 'docs', 'api-route-inventory.json');
const openapiPath = join(root, 'specs/001-ai-consultation-platform/contracts/openapi.yaml');

function toOpenApiPath(expressPath) {
  let p = String(expressPath || '').replace(/^\/api\/?/, '/');
  if (p === '') p = '/';
  p = p.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1) p = p.replace(/\/$/, '');
  return p === '/api' ? '/' : p;
}

function pathParams(openPath) {
  return [...openPath.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]);
}

function tagFor(openPath) {
  const seg = openPath.split('/').filter(Boolean)[0] || 'root';
  const map = {
    live: 'Ops',
    ready: 'Ops',
    health: 'Ops',
    metrics: 'Ops',
    auth: 'Auth',
    users: 'Users',
    consultations: 'Consultations',
    'service-requests': 'ServiceRequests',
    bookings: 'Bookings',
    vehicles: 'Vehicles',
    contact: 'Contact',
    content: 'Content',
    admin: 'Admin',
    analytics: 'Analytics',
    manager: 'Integrations',
    webhooks: 'Integrations',
    'product-events': 'Product',
  };
  return map[seg] || 'Other';
}

const HINTS = {
  'GET /live': 'Liveness (процесс жив, без БД)',
  'GET /ready': 'Readiness (БД и Redis при наличии)',
  'GET /health': 'Совместимый alias readiness',
  'GET /metrics': 'Prometheus text (in-process)',
  'POST /product-events': 'Продуктовое событие воронки',
  'POST /consultations': 'Создать консультацию (клиент или гость)',
  'POST /consultations/{sessionId}/messages': 'Сообщение в консультацию',
  'GET /consultations/{sessionId}': 'Карточка консультации с сообщениями',
  'PATCH /bookings/{bookingId}': 'Перенос, отмена или статус записи',
  'GET /users/me': 'Профиль текущего пользователя',
};

function requestSchemaFor(method, openPath) {
  const key = `${method} ${openPath}`;
  const map = {
    'POST /consultations': 'ConsultationCreate',
    'POST /consultations/{sessionId}/messages': 'ConsultationMessage',
    'POST /consultations/{sessionId}/messages/stream': 'ConsultationMessage',
    'POST /consultations/{sessionId}/claim': 'ConsultationClaim',
    'POST /consultations/{sessionId}/report': 'ConsultationReportCreate',
    'POST /consultations/{sessionId}/analyze-photo': 'ConsultationPhoto',
    'POST /consultations/{sessionId}/service-request-guest': 'GuestServiceRequestCreate',
    'POST /bookings': 'BookingCreate',
    'POST /bookings/guest': 'BookingGuestCreate',
    'PATCH /bookings/{bookingId}': 'BookingPatch',
    'POST /auth/login': 'AuthLogin',
    'POST /auth/register': 'AuthRegister',
    'POST /auth/refresh': 'AuthRefresh',
    'POST /auth/forgot-password': 'PasswordResetRequest',
    'POST /auth/reset-password': 'PasswordResetConfirm',
    'POST /contact': 'ContactCreate',
    'POST /service-requests': 'ServiceRequestCreate',
    'PATCH /service-requests/{requestId}': 'ServiceRequestPatch',
    'PATCH /service-requests/{requestId}/assign-manager': 'AssignManager',
    'PUT /service-requests/{requestId}/consultation-feedback': 'ConsultationFeedbackCreate',
    'POST /service-requests/{requestId}/completion-documents': 'CompletionDocumentCreate',
    'POST /service-requests/bulk/status': 'BulkStatusPatch',
    'POST /service-requests/bulk/assign': 'BulkAssign',
    'POST /service-requests/bulk/export-crm': 'BulkExportCrm',
    'POST /vehicles': 'VehicleCreate',
    'PATCH /vehicles/{vehicleId}': 'VehiclePatch',
    'POST /vehicles/{vehicleId}/photo': 'VehiclePhoto',
    'PATCH /users/me': 'UserPatch',
    'POST /users/me/password': 'ChangePassword',
    'POST /users/me/2fa/confirm': 'TotpConfirm',
    'POST /users/me/2fa/disable': 'TotpDisable',
    'POST /users/me/2fa/backup-codes': 'TotpVerify',
    'POST /users/me/avatar': 'AvatarUpload',
    'PATCH /users/me/notification-preferences': 'NotificationPrefs',
    'POST /users/me/notifications/read': 'MarkNotificationsRead',
    'POST /users/me/sessions/revoke/start': 'SessionRevokeStart',
    'POST /users/me/sessions/revoke-others': 'SessionRevokeConfirm',
    'DELETE /users/me/sessions/{sessionId}': 'SessionRevokeConfirm',
    'POST /users/me/login-methods': 'LoginMethodsPatch',
  };
  return map[key] || null;
}

function responseSchemaFor(method, openPath) {
  const key = `${method} ${openPath}`;
  const map = {
    'POST /consultations': 'Consultation',
    'GET /consultations': 'ConsultationList',
    'GET /consultations/{sessionId}': 'ConsultationDetail',
    'POST /consultations/{sessionId}/messages': 'ConsultationDetail',
    'POST /consultations/{sessionId}/claim': 'ConsultationDetail',
    'GET /consultations/{sessionId}/diagnosis-job': 'DiagnosisJob',
    'GET /consultations/staff': 'CursorPage',
    'GET /bookings': 'BookingList',
    'GET /bookings/{bookingId}': 'Booking',
    'POST /bookings': 'Booking',
    'POST /bookings/guest': 'Booking',
    'PATCH /bookings/{bookingId}': 'Booking',
    'GET /bookings/{bookingId}/audit': 'BookingAuditList',
    'GET /service-requests': 'CursorPage',
    'GET /service-requests/{requestId}': 'ServiceRequest',
    'GET /service-requests/{id}': 'ServiceRequest',
    'POST /service-requests': 'ServiceRequest',
    'PATCH /service-requests/{requestId}': 'ServiceRequest',
    'POST /service-requests/{requestId}/assign-to-me': 'ServiceRequest',
    'PATCH /service-requests/{requestId}/assign-manager': 'ServiceRequest',
    'POST /consultations/{sessionId}/service-request': 'ServiceRequest',
    'POST /consultations/{sessionId}/service-request-guest': 'ServiceRequest',
    'GET /users/me': 'User',
    'PATCH /users/me': 'User',
    'GET /users/me/security': 'SecurityStatus',
    'GET /users/me/sessions': 'SessionList',
    'GET /users/me/notifications': 'InboxNotificationList',
    'GET /users/me/notifications/unread-count': 'InboxUnreadCount',
    'GET /users/me/notification-preferences': 'NotificationPrefs',
    'PATCH /users/me/notification-preferences': 'NotificationPrefs',
    'POST /users/me/notifications/read': 'InboxUnreadCount',
    'GET /vehicles': 'VehicleList',
    'GET /vehicles/{vehicleId}': 'Vehicle',
    'POST /vehicles': 'Vehicle',
    'PATCH /vehicles/{vehicleId}': 'Vehicle',
    'POST /vehicles/{vehicleId}/photo': 'Vehicle',
    'DELETE /vehicles/{vehicleId}/photo': 'Vehicle',
    'GET /live': 'LiveStatus',
    'GET /ready': 'LiveStatus',
    'GET /health': 'LiveStatus',
    'POST /auth/login': 'AuthSession',
    'POST /auth/register': 'AuthPending',
    'POST /auth/refresh': 'AuthSession',
    'POST /users/me/2fa/setup/cancel': 'Ok',
  };
  return map[key] || null;
}

const SCHEMA_YAML = `
Problem:
  type: object
  properties:
    type: { type: string }
    title: { type: string }
    status: { type: integer }
    detail: { type: string }
    instance: { type: string }
    error: { type: string }
    code: { type: string }
Ok:
  type: object
  properties:
    ok: { type: boolean }
ConsultationCreate:
  type: object
  additionalProperties: true
  properties:
    serviceCategoryId: { type: string, format: uuid }
Consultation:
  type: object
  properties:
    id: { type: string, format: uuid }
    status: { type: string }
    guestToken: { type: string, nullable: true }
    vehicleId: { type: string, format: uuid, nullable: true }
    progressPercent: { type: integer, nullable: true }
    confidencePercent: { type: integer, nullable: true }
    isGuest: { type: boolean }
    createdAt: { type: string, format: date-time }
ConsultationDetail:
  allOf:
    - $ref: '#/components/schemas/Consultation'
    - type: object
      additionalProperties: true
      properties:
        flowState: { type: object, nullable: true }
        messages:
          type: array
          items: { $ref: '#/components/schemas/ConsultationChatMessage' }
ConsultationChatMessage:
  type: object
  properties:
    id: { type: string, format: uuid }
    sender: { type: string }
    content: { type: string }
    createdAt: { type: string, format: date-time }
ConsultationList:
  type: array
  items: { $ref: '#/components/schemas/Consultation' }
ConsultationMessage:
  type: object
  required: [content]
  properties:
    content: { type: string }
ConsultationClaim:
  type: object
  required: [guestToken]
  properties:
    guestToken: { type: string }
ConsultationReportCreate:
  type: object
  properties:
    label: { type: string }
ConsultationPhoto:
  type: object
  required: [mimeType, imageBase64]
  properties:
    mimeType: { type: string, enum: [image/jpeg, image/png, image/webp] }
    imageBase64: { type: string }
GuestServiceRequestCreate:
  type: object
  required: [fullName, phone, consentPersonalData]
  properties:
    fullName: { type: string }
    phone: { type: string }
    email: { type: string, nullable: true }
    consentPersonalData: { type: boolean }
DiagnosisJob:
  type: object
  properties:
    id: { type: string, format: uuid }
    sessionId: { type: string, format: uuid }
    status: { type: string }
    errorMessage: { type: string, nullable: true }
BookingCreate:
  type: object
  required: [preferredAt]
  properties:
    preferredAt: { type: string, format: date-time }
    notes: { type: string, nullable: true }
    serviceRequestId: { type: string, format: uuid, nullable: true }
    vehicleId: { type: string, format: uuid, nullable: true }
BookingGuestCreate:
  type: object
  required: [preferredAt, fullName, phone, consentPersonalData]
  properties:
    preferredAt: { type: string, format: date-time }
    fullName: { type: string }
    phone: { type: string }
    email: { type: string, nullable: true }
    notes: { type: string, nullable: true }
    serviceTitle: { type: string, nullable: true }
    categoryLabel: { type: string, nullable: true }
    consentPersonalData: { type: boolean }
BookingPatch:
  type: object
  properties:
    status: { type: string, enum: [PENDING, CONFIRMED, ARRIVED, NO_SHOW, CANCELLED] }
    preferredAt: { type: string, format: date-time }
    notes: { type: string, nullable: true }
Booking:
  type: object
  properties:
    id: { type: string, format: uuid }
    status: { type: string }
    preferredAt: { type: string, format: date-time }
    clientId: { type: string, format: uuid, nullable: true }
    vehicleId: { type: string, format: uuid, nullable: true }
    serviceRequestId: { type: string, format: uuid, nullable: true }
    notes: { type: string, nullable: true }
    createdAt: { type: string, format: date-time }
BookingList:
  oneOf:
    - type: array
      items: { $ref: '#/components/schemas/Booking' }
    - type: object
      properties:
        items:
          type: array
          items: { $ref: '#/components/schemas/Booking' }
        nextCursor: { type: string, nullable: true }
BookingAuditList:
  type: object
  properties:
    items:
      type: array
      items:
        type: object
        additionalProperties: true
ServiceRequest:
  type: object
  additionalProperties: true
  properties:
    id: { type: string, format: uuid }
    status: { type: string }
    version: { type: integer }
    clientId: { type: string, format: uuid, nullable: true }
    snapshotMake: { type: string, nullable: true }
    snapshotModel: { type: string, nullable: true }
    snapshotSymptoms: { type: string, nullable: true }
    createdAt: { type: string, format: date-time }
    slaBreached: { type: boolean }
ServiceRequestCreate:
  type: object
  additionalProperties: true
  properties:
    sessionId: { type: string, format: uuid }
ServiceRequestPatch:
  type: object
  required: [status, expectedVersion]
  properties:
    status: { type: string, enum: [NEW, IN_PROGRESS, SCHEDULED, COMPLETED, CANCELLED] }
    expectedVersion: { type: integer }
AssignManager:
  type: object
  required: [managerId]
  properties:
    managerId: { type: string, format: uuid }
ConsultationFeedbackCreate:
  type: object
  required: [verdict]
  properties:
    verdict: { type: string, enum: [CORRECT, PARTIAL, INCORRECT] }
    actualCause: { type: string }
    worksDone: { type: string }
    repairAmountMinor: { type: integer, nullable: true }
CompletionDocumentCreate:
  type: object
  required: [kind, fileName, mimeType, contentBase64]
  properties:
    kind: { type: string, enum: [WORK_ORDER, RECEIPT, WARRANTY, ACT, OTHER] }
    label: { type: string, nullable: true }
    fileName: { type: string }
    mimeType: { type: string }
    contentBase64: { type: string }
BulkStatusPatch:
  type: object
  required: [ids, status]
  properties:
    ids:
      type: array
      items: { type: string, format: uuid }
    status: { type: string, enum: [NEW, IN_PROGRESS, SCHEDULED, COMPLETED, CANCELLED] }
BulkAssign:
  type: object
  required: [ids]
  properties:
    ids:
      type: array
      items: { type: string, format: uuid }
    managerId: { type: string, format: uuid }
BulkExportCrm:
  type: object
  required: [ids]
  properties:
    ids:
      type: array
      items: { type: string, format: uuid }
    connectionId: { type: string, format: uuid }
CursorPage:
  type: object
  properties:
    items: { type: array, items: { type: object } }
    nextCursor: { type: string, nullable: true }
    total: { type: integer }
    limit: { type: integer }
    offset: { type: integer }
AuthLogin:
  type: object
  required: [identifier, password]
  properties:
    identifier: { type: string }
    password: { type: string }
User:
  type: object
  properties:
    id: { type: string, format: uuid }
    email: { type: string }
    fullName: { type: string }
    phone: { type: string }
    role: { type: string }
    city: { type: string, nullable: true }
    totpEnabled: { type: boolean }
    emailVerified: { type: boolean }
    phoneVerified: { type: boolean }
    telegramLinked: { type: boolean }
UserPatch:
  type: object
  properties:
    fullName: { type: string }
    phone: { type: string }
    emailProfile: { type: string, nullable: true }
    city: { type: string, nullable: true }
    telegram: { type: string, nullable: true }
    preferredContact: { type: string, enum: [PHONE, EMAIL, TELEGRAM], nullable: true }
ChangePassword:
  type: object
  required: [currentPassword, newPassword]
  properties:
    currentPassword: { type: string }
    newPassword: { type: string }
TotpConfirm:
  type: object
  required: [code]
  properties:
    code: { type: string }
TotpVerify:
  type: object
  required: [password, code]
  properties:
    password: { type: string }
    code: { type: string }
TotpDisable:
  type: object
  required: [password, code, confirmPhrase]
  properties:
    password: { type: string }
    code: { type: string }
    confirmPhrase: { type: string }
AvatarUpload:
  type: object
  required: [mimeType, contentBase64]
  properties:
    mimeType: { type: string }
    contentBase64: { type: string }
NotificationPrefs:
  type: object
  properties:
    bookingReminders: { type: boolean }
    messageAlerts: { type: boolean }
    marketing: { type: boolean }
    channelEmail: { type: boolean }
    channelTelegram: { type: boolean }
    channelSms: { type: boolean }
MarkNotificationsRead:
  type: object
  properties:
    ids:
      type: array
      items: { type: string, format: uuid }
SessionRevokeStart:
  type: object
  properties:
    scope: { type: string, enum: [one, others] }
    sessionId: { type: string, format: uuid }
SessionRevokeConfirm:
  type: object
  required: [code]
  properties:
    code: { type: string }
LoginMethodsPatch:
  type: object
  properties:
    loginEmailOtpEnabled: { type: boolean }
    loginSmsEnabled: { type: boolean }
    loginTelegramEnabled: { type: boolean }
SecurityStatus:
  type: object
  additionalProperties: true
  properties:
    totpEnabled: { type: boolean }
    emailVerified: { type: boolean }
    phoneVerified: { type: boolean }
    telegramLinked: { type: boolean }
SessionList:
  type: object
  properties:
    items:
      type: array
      items:
        type: object
        additionalProperties: true
InboxNotificationList:
  type: object
  properties:
    items:
      type: array
      items: { $ref: '#/components/schemas/InboxNotification' }
    unreadCount: { type: integer }
InboxNotification:
  type: object
  properties:
    id: { type: string, format: uuid }
    kind: { type: string }
    title: { type: string }
    body: { type: string }
    href: { type: string, nullable: true }
    readAt: { type: string, format: date-time, nullable: true }
    createdAt: { type: string, format: date-time }
InboxUnreadCount:
  type: object
  properties:
    unreadCount: { type: integer }
    updated: { type: integer }
Vehicle:
  type: object
  additionalProperties: true
  properties:
    id: { type: string, format: uuid }
    make: { type: string }
    model: { type: string }
    year: { type: integer, nullable: true }
    vin: { type: string, nullable: true }
    licensePlate: { type: string, nullable: true }
    color: { type: string, nullable: true }
    currentMileageKm: { type: integer, nullable: true }
    photoUrl: { type: string, nullable: true }
VehicleList:
  type: array
  items: { $ref: '#/components/schemas/Vehicle' }
VehicleCreate:
  type: object
  required: [make, model]
  properties:
    make: { type: string }
    model: { type: string }
    year: { type: integer, nullable: true }
    vin: { type: string, nullable: true }
    notes: { type: string, nullable: true }
    licensePlate: { type: string, nullable: true }
    color: { type: string, nullable: true }
VehiclePatch:
  type: object
  properties:
    currentMileageKm: { type: integer, nullable: true }
    vin: { type: string, nullable: true }
    notes: { type: string, nullable: true }
    licensePlate: { type: string, nullable: true }
    color: { type: string, nullable: true }
VehiclePhoto:
  type: object
  required: [mimeType, contentBase64]
  properties:
    mimeType: { type: string }
    contentBase64: { type: string }
ContactCreate:
  type: object
  required: [fullName, phone]
  properties:
    fullName: { type: string }
    phone: { type: string }
    email: { type: string }
LiveStatus:
  type: object
  properties:
    status: { type: string }
    uptimeSec: { type: number }
AuthRegister:
  type: object
  required: [email, password, fullName, phone]
  properties:
    email: { type: string }
    password: { type: string }
    fullName: { type: string }
    phone: { type: string }
AuthRefresh:
  type: object
  properties:
    refreshToken: { type: string }
AuthSession:
  type: object
  properties:
    accessToken: { type: string }
    refreshToken: { type: string }
    user: { $ref: '#/components/schemas/User' }
    requires2fa: { type: boolean }
AuthPending:
  type: object
  properties:
    requiresEmailVerification: { type: boolean }
    message: { type: string }
PasswordResetRequest:
  type: object
  required: [email]
  properties:
    email: { type: string }
PasswordResetConfirm:
  type: object
  required: [token, password]
  properties:
    token: { type: string }
    password: { type: string }
`.trim();

function yamlQuote(value) {
  if (value == null) return '""';
  const s = String(value);
  if (/[:#{}[\],&*?]|^\s|\s$/.test(s)) return JSON.stringify(s);
  return s;
}

function methodSummary(method, openPath) {
  const hint = HINTS[`${method} ${openPath}`];
  if (hint) return hint;
  const last = openPath.split('/').filter(Boolean).slice(-1)[0] || 'root';
  const verbs = { GET: 'Получить', POST: 'Создать/выполнить', PATCH: 'Обновить', PUT: 'Заменить', DELETE: 'Удалить' };
  return `${verbs[method] || method} ${last}`;
}

function buildYaml(routes) {
  /** @type {Map<string, { method: string, expressPath: string }[]>} */
  const byPath = new Map();
  for (const row of routes) {
    const openPath = toOpenApiPath(row.path);
    const list = byPath.get(openPath) || [];
    list.push({ method: row.method.toLowerCase(), expressPath: row.path });
    byPath.set(openPath, list);
  }

  const lines = [
    'openapi: 3.0.3',
    'info:',
    '  title: Car Service AI Assistant API',
    '  version: 0.5.0',
    '  description: >',
    '    Полный операционный контракт, сгенерированный из runtime Express',
    '    (`docs/api-route-inventory.json`). Живые маршруты кабинета (запись, заявки,',
    '    консультации, профиль/гараж) ссылаются на именованные схемы; хвост ops — object stub.',
    '    Источник истины по наличию path+method — инвентарь + `npm run openapi:check`.',
    'servers:',
    '  - url: http://localhost:3000/api',
    'tags:',
    '  - name: Ops',
    '  - name: Auth',
    '  - name: Consultations',
    '  - name: ServiceRequests',
    '  - name: Bookings',
    '  - name: Users',
    '  - name: Vehicles',
    '  - name: Contact',
    '  - name: Content',
    '  - name: Admin',
    '  - name: Analytics',
    '  - name: Integrations',
    '  - name: Product',
    '  - name: Other',
    'paths:',
  ];

  const usedIds = new Set();
  const sortedPaths = [...byPath.keys()].sort();
  for (const openPath of sortedPaths) {
    const ops = byPath.get(openPath);
    const seen = new Set();
    lines.push(`  ${JSON.stringify(openPath)}:`);
    for (const op of ops) {
      if (seen.has(op.method)) continue;
      seen.add(op.method);
      const params = pathParams(openPath);
      let operationId = `${op.method}_${openPath.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'root'}`;
      if (usedIds.has(operationId)) {
        let n = 2;
        while (usedIds.has(`${operationId}_${n}`)) n += 1;
        operationId = `${operationId}_${n}`;
      }
      usedIds.add(operationId);
      lines.push(`    ${op.method}:`);
      lines.push(`      tags: [${tagFor(openPath)}]`);
      lines.push(`      summary: ${yamlQuote(methodSummary(op.method.toUpperCase(), openPath))}`);
      lines.push(`      operationId: ${operationId}`);
      if (params.length) {
        lines.push('      parameters:');
        for (const name of params) {
          lines.push(`        - in: path`);
          lines.push(`          name: ${name}`);
          lines.push('          required: true');
          lines.push('          schema: { type: string }');
        }
      }
      if (['post', 'patch', 'put'].includes(op.method) || requestSchemaFor(op.method.toUpperCase(), openPath)) {
        const reqRef = requestSchemaFor(op.method.toUpperCase(), openPath);
        lines.push('      requestBody:');
        lines.push('        content:');
        lines.push('          application/json:');
        lines.push(reqRef ? `            schema: { $ref: '#/components/schemas/${reqRef}' }` : '            schema: { type: object }');
      }
      lines.push('      responses:');
      lines.push("        '200':");
      lines.push('          description: OK');
      const resRef = responseSchemaFor(op.method.toUpperCase(), openPath);
      if (resRef) {
        lines.push('          content:');
        lines.push('            application/json:');
        lines.push(`              schema: { $ref: '#/components/schemas/${resRef}' }`);
      }
      lines.push("        '4XX':");
      lines.push('          description: Problem Details (RFC 9457)');
      lines.push('          content:');
      lines.push('            application/problem+json:');
      lines.push('              schema:');
      lines.push('                $ref: \'#/components/schemas/Problem\'');
    }
  }

  lines.push('components:');
  lines.push('  schemas:');
  lines.push(...SCHEMA_YAML.split('\n').filter((line) => line.length > 0).flatMap((line) => [`    ${line}`]));
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function listOpenApiOps(yaml) {
  const ops = [];
  let currentPath = null;
  for (const line of yaml.split('\n')) {
    const pathMatch = line.match(/^  ("(?:\\.|[^"])+"|\/\S*):$/);
    if (pathMatch) {
      const raw = pathMatch[1];
      currentPath = raw.startsWith('"') ? JSON.parse(raw) : raw;
      continue;
    }
    const methodMatch = line.match(/^    (get|post|put|patch|delete):$/);
    if (methodMatch && currentPath) {
      ops.push({ method: methodMatch[1].toUpperCase(), path: currentPath });
    }
  }
  return ops;
}

const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
const expected = inventory.routes.map((r) => ({
  method: r.method.toUpperCase(),
  path: toOpenApiPath(r.path),
}));

if (process.argv.includes('--check')) {
  const yaml = readFileSync(openapiPath, 'utf8');
  const actual = listOpenApiOps(yaml);
  const a = new Set(expected.map((r) => `${r.method} ${r.path}`));
  const b = new Set(actual.map((r) => `${r.method} ${r.path}`));
  const missing = [...a].filter((k) => !b.has(k));
  const extra = [...b].filter((k) => !a.has(k));
  if (missing.length || extra.length) {
    console.error(`OpenAPI drift: inventory ${a.size} ops, spec ${b.size} ops.`);
    if (missing.length) console.error(`Missing in OpenAPI (${missing.length}): ${missing.slice(0, 12).join(', ')}`);
    if (extra.length) console.error(`Extra in OpenAPI (${extra.length}): ${extra.slice(0, 12).join(', ')}`);
    console.error('Update with: npm run openapi:sync');
    process.exit(1);
  }
  const named = [...yaml.matchAll(/^    ([A-Z][A-Za-z0-9]+):$/gm)].length;
  console.log(`OpenAPI OK (${b.size} operations, ${inventory.count} inventory routes, ${named} named schemas)`);
  process.exit(0);
}

mkdirSync(dirname(openapiPath), { recursive: true });
writeFileSync(openapiPath, buildYaml(inventory.routes));
console.log(`Wrote ${openapiPath} (${expected.length} operations)`);
