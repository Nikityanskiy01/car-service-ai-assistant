import { useMemo, useState } from 'react';
import { api } from '../../api/client';
import { FormField } from '../../components/forms/FormField';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { usePageMeta } from '../../hooks/usePageMeta';
import { STORAGE_KEYS } from '../../lib/storageKeys';

export function BookingPage() {
  usePageMeta({
    title: 'Запись на обслуживание',
    description: 'Создание сервисной записи из консультации или напрямую через форму обращения.',
  });
  const prefill = useMemo(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEYS.bookingPrefill);
      return raw ? (JSON.parse(raw) as { serviceTitle?: string; categoryLabel?: string }) : {};
    } catch {
      return {};
    }
  }, []);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [preferredAt, setPreferredAt] = useState('');
  const [notes, setNotes] = useState(prefill.serviceTitle ? `Интересует услуга: ${prefill.serviceTitle}` : '');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      await api('/bookings/guest', {
        method: 'POST',
        body: {
          preferredAt,
          fullName,
          phone,
          email: email || null,
          notes: notes || null,
          serviceTitle: prefill.serviceTitle || null,
          categoryLabel: prefill.categoryLabel || null,
        },
        skipAuthRefresh: true,
      });
      setStatus('Запись отправлена. Менеджер свяжется с вами.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось создать запись.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <h1>Запись на обслуживание</h1>
      <Card>
        <form className="stack" onSubmit={onSubmit}>
          <FormField label="Имя" htmlFor="bookingName">
            <Input id="bookingName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </FormField>
          <FormField label="Телефон" htmlFor="bookingPhone">
            <PhoneInput id="bookingPhone" required value={phone} onChange={setPhone} />
          </FormField>
          <FormField label="Email (опционально)" htmlFor="bookingEmail">
            <Input
              id="bookingEmail"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
          <FormField label="Предпочтительное время" htmlFor="bookingDate">
            <Input
              id="bookingDate"
              type="datetime-local"
              required
              value={preferredAt}
              onChange={(e) => setPreferredAt(e.target.value)}
            />
          </FormField>
          <FormField label="Комментарий" htmlFor="bookingNotes">
            <Textarea id="bookingNotes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>
          <Button disabled={loading}>{loading ? 'Отправка...' : 'Отправить заявку'}</Button>
          {status ? <p>{status}</p> : null}
        </form>
      </Card>
    </div>
  );
}
