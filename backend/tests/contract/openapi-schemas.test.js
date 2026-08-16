import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const yaml = readFileSync(
  join(root, 'specs/001-ai-consultation-platform/contracts/openapi.yaml'),
  'utf8',
);

describe('OpenAPI rich schemas', () => {
  test('core resource schemas exist', () => {
    for (const name of ['Problem', 'Consultation', 'Booking', 'BookingList', 'ServiceRequest', 'CursorPage']) {
      expect(yaml).toContain(`${name}:`);
    }
  });

  test('consultation create references schema', () => {
    expect(yaml).toContain('#/components/schemas/ConsultationCreate');
    expect(yaml).toContain('#/components/schemas/Booking');
  });
});
