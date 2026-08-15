export function bookingPath(vehicleId?: string | null) {
  if (!vehicleId) return '/booking';
  return `/booking?vehicleId=${encodeURIComponent(vehicleId)}`;
}
