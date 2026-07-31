import type { ClientDashboardSummary } from './resolveClientHero';
import type { ClientHeroState } from './resolveClientHero';
import { getDaysUntilBooking } from '../../lib/bookingCountdown';

export type OverviewFocus =
  | {
      type: 'draft';
      title: string;
      description: string;
      ctaLabel: string;
      ctaTo: string;
      ctaSessionId: string;
    }
  | {
      type: 'booking';
      booking: NonNullable<ClientDashboardSummary['nextBooking']>;
      daysUntil: number;
    }
  | {
      type: 'hero';
      hero: ClientHeroState;
    };

const BOOKING_FOCUS_DAYS = 14;

export function resolveOverviewFocus(
  summary: ClientDashboardSummary,
  hero: ClientHeroState,
): OverviewFocus | null {
  if (hero.isNewcomer) return null;

  const draft = summary.draftConsultation;
  if (draft?.id) {
    const vehicle = [draft.make, draft.model].filter(Boolean).join(' ');
    return {
      type: 'draft',
      title: vehicle ? `Продолжить диагностику: ${vehicle}` : 'Диагностика не завершена',
      description: draft.symptom
        ? `«${draft.symptom.length > 72 ? `${draft.symptom.slice(0, 69)}...` : draft.symptom}»`
        : 'Вернитесь в чат и уточните симптомы — это займёт минуту.',
      ctaLabel: 'Продолжить в чате',
      ctaTo: '/consult',
      ctaSessionId: draft.id,
    };
  }

  if (summary.nextBooking) {
    const daysUntil = getDaysUntilBooking(summary.nextBooking.preferredAt);
    if (daysUntil >= 0 && daysUntil <= BOOKING_FOCUS_DAYS) {
      return { type: 'booking', booking: summary.nextBooking, daysUntil };
    }
  }

  return { type: 'hero', hero };
}

export function shouldShowBookingSection(
  summary: ClientDashboardSummary,
  focus: OverviewFocus | null,
): boolean {
  if (!summary.nextBooking) return false;
  if (focus?.type === 'booking') return false;
  return true;
}

export function shouldShowBookingAlert(
  focus: OverviewFocus | null,
): boolean {
  return focus?.type !== 'booking';
}
