import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const yaml = readFileSync(
  join(root, 'specs/001-ai-consultation-platform/contracts/openapi.yaml'),
  'utf8',
);

const NAMED = [
  'Problem',
  'Consultation',
  'ConsultationDetail',
  'ConsultationMessage',
  'ConsultationClaim',
  'ConsultationPhoto',
  'GuestServiceRequestCreate',
  'DiagnosisJob',
  'Booking',
  'BookingList',
  'BookingGuestCreate',
  'BookingPatch',
  'ServiceRequest',
  'ServiceRequestPatch',
  'AssignManager',
  'ConsultationFeedbackCreate',
  'CompletionDocumentCreate',
  'BulkStatusPatch',
  'CursorPage',
  'AuthLogin',
  'User',
  'Vehicle',
  'VehiclePatch',
  'VehiclePhoto',
  'LiveStatus',
  'AuthSession',
  'ChangePassword',
  'TotpConfirm',
  'NotificationPrefs',
  'InboxNotificationList',
  'SecurityStatus',
  'SessionRevokeConfirm',
];

describe('OpenAPI rich schemas', () => {
  test('cabinet and live resource schemas exist', () => {
    for (const name of NAMED) {
      expect(yaml).toContain(`${name}:`);
    }
  });

  test('live routes reference named schemas instead of object stubs', () => {
    expect(yaml).toContain('#/components/schemas/ConsultationCreate');
    expect(yaml).toContain('#/components/schemas/ConsultationDetail');
    expect(yaml).toContain('#/components/schemas/BookingGuestCreate');
    expect(yaml).toContain('#/components/schemas/BookingPatch');
    expect(yaml).toContain('#/components/schemas/ServiceRequestPatch');
    expect(yaml).toContain('#/components/schemas/VehiclePatch');
    expect(yaml).toContain('#/components/schemas/ChangePassword');
    expect(yaml).toContain('#/components/schemas/InboxNotificationList');
  });
});
