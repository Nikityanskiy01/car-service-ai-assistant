interface BookingItem {
  id: string;
  preferredAt: string;
  status: string;
  guestName?: string | null;
  client?: { fullName?: string | null } | null;
}

export function BookingCalendar({ bookings }: { bookings: BookingItem[] }) {
  const grouped = bookings.reduce<Record<string, BookingItem[]>>((acc, booking) => {
    const day = new Date(booking.preferredAt).toLocaleDateString();
    acc[day] = acc[day] || [];
    acc[day].push(booking);
    return acc;
  }, {});

  return (
    <section className="booking-calendar">
      <h3>Календарь записей</h3>
      {Object.keys(grouped).length === 0 ? (
        <p>Пока нет назначенных визитов.</p>
      ) : (
        <div className="booking-days">
          {Object.entries(grouped).map(([day, items]) => (
            <article key={day} className="booking-day">
              <h4>{day}</h4>
              <ul>
                {items.map((item) => (
                  <li key={item.id}>
                    <strong>{new Date(item.preferredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                    <span>{item.client?.fullName || item.guestName || 'Клиент'}</span>
                    <small>{item.status}</small>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
