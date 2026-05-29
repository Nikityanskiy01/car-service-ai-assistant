import { describe, expect, it } from '@jest/globals';
import {
  getDiagnosticsQualityGate,
  getDiagnosticsTelemetrySnapshot,
  telemetryInc,
  telemetryObserveMessageLatency,
} from '../../src/services/diagnosticsTelemetry.service.js';

describe('diagnostics telemetry', () => {
  it('возвращает снапшот с p95 и счетчиками', () => {
    telemetryInc('requests');
    telemetryObserveMessageLatency(9000);
    const snap = getDiagnosticsTelemetrySnapshot();
    expect(snap).toHaveProperty('latency.message.p95');
    expect(snap).toHaveProperty('counters.requests');
  });

  it('возвращает quality gate структуру', () => {
    const gate = getDiagnosticsQualityGate();
    expect(typeof gate.pass).toBe('boolean');
    expect(Array.isArray(gate.failures)).toBe(true);
    expect(gate).toHaveProperty('recommendedAction');
  });
});
