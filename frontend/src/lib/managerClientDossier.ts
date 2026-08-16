import { CLIENT_BOOKING_STATUS_LABELS } from './clientStatusLabels';
import {
  CONTACT_STATUS_LABELS,
  SERVICE_REQUEST_STATUS_LABELS,
} from './labels';
import { digitsOnly } from './phone';
import type {
  ClientDossier,
  DossierBookingRow,
  DossierConsultationRow,
  DossierMetrics,
  DossierRequestRow,
  DossierServiceRecord,
  DossierVehicle,
  GuestDossier,
} from '../types/dashboard';
import type { ManagerClientRow, ManagerClientVehicle } from '../api/dashboard';

const CONSULTATION_STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: 'В диалоге',
  COMPLETED: 'Завершена',
  ABANDONED: 'Брошена',
  AI_ERROR: 'Ошибка ИИ',
};

const PREFERRED_CONTACT_LABELS: Record<string, string> = {
  PHONE: 'телефон',
  EMAIL: 'почта',
  TELEGRAM: 'Telegram',
};

const ACTIVE_REQUEST_STATUSES = ['NEW', 'IN_PROGRESS', 'SCHEDULED'];
const UPCOMING_BOOKING = ['PENDING', 'CONFIRMED'];

export const clientCurrency = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

export type ClientDossierView = {
  name: string;
  isGuest: boolean;
  phone: string;
  email: string;
  telegram: string;
  city: string;
  preferredContact: string | null;
  createdAt: string | null;
  vehicles: DossierVehicle[];
  requests: DossierRequestRow[];
  bookings: DossierBookingRow[];
  consultations: DossierConsultationRow[];
  contacts: GuestDossier['contacts'];
  serviceRecords: DossierServiceRecord[];
  metrics?: DossierMetrics;
};

export function preferredContactLabel(value?: string | null) {
  if (!value) return null;
  return PREFERRED_CONTACT_LABELS[value] || value;
}

export function statusLabel(status: string) {
  return (
    SERVICE_REQUEST_STATUS_LABELS[status as keyof typeof SERVICE_REQUEST_STATUS_LABELS] ||
    CLIENT_BOOKING_STATUS_LABELS[status] ||
    CONTACT_STATUS_LABELS[status] ||
    CONSULTATION_STATUS_LABELS[status] ||
    status
  );
}

export function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' {
  if (status === 'COMPLETED' || status === 'CONFIRMED' || status === 'CONVERTED' || status === 'ARRIVED') {
    return 'success';
  }
  if (status === 'CANCELLED' || status === 'NO_SHOW' || status === 'ABANDONED' || status === 'AI_ERROR') {
    return 'destructive';
  }
  if (status === 'NEW') return 'default';
  if (status === 'IN_PROGRESS') return 'warning';
  if (ACTIVE_REQUEST_STATUSES.includes(status) || status === 'PENDING') return 'secondary';
  return 'secondary';
}

export function firstNameOf(name: string) {
  const parts = name.replace(/^Гость\s+/i, '').trim().split(/\s+/).filter(Boolean);
  return parts[0] || name;
}

export function telHref(phone: string) {
  const digits = digitsOnly(phone);
  return digits ? `tel:+${digits}` : undefined;
}

export function telegramHref(value: string) {
  const handle = value.replace(/^@/, '').replace(/^https?:\/\/t\.me\//i, '');
  return `https://t.me/${handle}`;
}

export function formatDay(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function formatDayTime(iso: string) {
  const date = new Date(iso);
  const day = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time}`;
}

export function visitParts(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return {
    day: date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
    weekday: date.toLocaleDateString('ru-RU', { weekday: 'short' }),
    time: date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
  };
}

export function vehicleTitle(vehicle: {
  make?: string | null;
  model?: string | null;
  year?: number | null;
}) {
  return [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ');
}

export function vehicleLine(vehicle: ManagerClientVehicle | DossierVehicle) {
  const title = vehicleTitle(vehicle);
  const plate = 'licensePlate' in vehicle ? vehicle.licensePlate : null;
  if (title && plate) return `${title} · ${plate}`;
  return title || plate || '';
}

export function rosterVehicleSummary(client: ManagerClientRow) {
  const vehicles = client.vehicles || [];
  if (!vehicles.length) return null;
  const first = vehicleLine(vehicles[0]);
  if (!first) return null;
  if (vehicles.length === 1) return first;
  return `${first} +${vehicles.length - 1}`;
}

export function clientInitials(name: string) {
  const parts = name.replace(/^Гость\s+/i, '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] || '';
  const second = parts.length > 1 ? parts[parts.length - 1][0] || '' : parts[0][1] || '';
  return `${first}${second}`.toUpperCase();
}

export function formatLtv(minor?: number | null) {
  if (!minor) return null;
  return clientCurrency.format(minor / 100);
}

export function buildClientDossierView(
  selected: ManagerClientRow | null,
  dossier: ClientDossier | null,
  guestDossier: GuestDossier | null,
): ClientDossierView | null {
  const profile = dossier?.profile || guestDossier?.profile;
  if (!profile && !selected) return null;
  const guest = Boolean((profile && 'isGuest' in profile && profile.isGuest) || selected?.isGuest);
  const name = (profile?.fullName || selected?.name || 'Клиент').replace(/^Гость\s+/i, '');
  return {
    name,
    isGuest: guest,
    phone: profile?.phone || selected?.phone || '',
    email: (profile && 'email' in profile && profile.email) || selected?.email || '',
    telegram: (profile && 'telegram' in profile && profile.telegram) || selected?.telegram || '',
    city: (profile && 'city' in profile && profile.city) || selected?.city || '',
    preferredContact: (profile && 'preferredContact' in profile && profile.preferredContact) || null,
    createdAt: profile && 'createdAt' in profile ? profile.createdAt : null,
    vehicles: dossier?.vehicles || guestDossier?.vehicles || [],
    requests: dossier?.requests || guestDossier?.requests || [],
    bookings: dossier?.bookings || guestDossier?.bookings || [],
    consultations: dossier?.consultations || guestDossier?.consultations || [],
    contacts: guestDossier?.contacts || [],
    serviceRecords: dossier?.serviceRecords || guestDossier?.serviceRecords || [],
    metrics: dossier?.metrics || guestDossier?.metrics,
  };
}

export function activeRequestsOf(view: ClientDossierView) {
  return view.requests.filter((item) => ACTIVE_REQUEST_STATUSES.includes(item.status));
}

export function upcomingBookingsOf(view: ClientDossierView) {
  const now = Date.now();
  return view.bookings
    .filter((item) => UPCOMING_BOOKING.includes(item.status) && new Date(item.preferredAt).getTime() >= now)
    .sort((a, b) => a.preferredAt.localeCompare(b.preferredAt));
}
