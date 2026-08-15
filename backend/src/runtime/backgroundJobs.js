import { startDiagnosisWorker, stopDiagnosisWorker } from '../services/diagnosisWorker.service.js';
import { startSlaEscalationJob, stopSlaEscalationJob } from '../jobs/slaEscalation.job.js';
import { startBookingReminderJob, stopBookingReminderJob } from '../jobs/bookingReminders.job.js';
import { startGuestSessionTtlJob, stopGuestSessionTtlJob } from '../jobs/guestSessionTtl.job.js';
import { startOutboxDrainJob, stopOutboxDrainJob } from '../jobs/outboxDrain.job.js';

export function startBackgroundJobs() {
  startDiagnosisWorker();
  startSlaEscalationJob();
  startBookingReminderJob();
  startGuestSessionTtlJob();
  startOutboxDrainJob();
}

export async function stopBackgroundJobs() {
  await stopDiagnosisWorker();
  stopSlaEscalationJob();
  stopBookingReminderJob();
  stopGuestSessionTtlJob();
  stopOutboxDrainJob();
}
